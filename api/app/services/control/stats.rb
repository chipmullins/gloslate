module Control
  # The numbers on Control's Dashboard and Insights. Plain SQL counts over the
  # ledger, active_days and analytics_events; nothing here changes anything.
  # Days are "Gloslate's day" (US Eastern), like ActiveDay.
  module Stats
    ZONE = ActiveDay::ZONE

    module_function

    def today = ActiveDay.today
    def day_start(day) = day.in_time_zone(ZONE).beginning_of_day

    def dashboard(now: Time.current)
      month_start = now.in_time_zone(ZONE).beginning_of_month
      t0 = day_start(today)
      groups = Household.where(kind: "group")
      {
        accounts: User.active.count,
        accounts_this_week: User.active.where(created_at: 7.days.ago..).count,
        active_today: ActiveDay.where(day: today).count,
        tabs: { total: Household.count, homes: Household.where(kind: "home").count, one_on_ones: one_on_one_count, groups: groups.count - one_on_one_count },
        friendships: Friendship.count / 2,
        expenses_today: Expense.active.where(created_at: t0..).count,
        expenses_today_cents: Expense.active.where(created_at: t0..).sum(:amount_cents),
        month: {
          expenses_cents: Expense.active.where(created_at: month_start..).sum(:amount_cents),
          requests: PaymentRequest.where(created_at: month_start..).count,
          payments_marked: Payment.where(marked_at: month_start..).count,
          payments_confirmed: Payment.counted.where(confirmed_at: month_start..).count,
          disputed: Payment.where(status: "disputed", disputed_at: month_start..).count
        },
        series: series(14),
        new_accounts: User.active.order(created_at: :desc).limit(6).map { |u| { id: u.id, name: short_name(u), created_at: u.created_at, how: how_joined(u) } },
        attention: attention
      }
    end

    # People active and expenses added per day, oldest first.
    def series(days)
      from = today - (days - 1)
      active = ActiveDay.where(day: from..).group(:day).count
      local = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE '#{ZONE}')::date"
      expenses = Expense.active.where(created_at: day_start(from)..).group(Arel.sql(local)).count
      (from..today).map { |d| { day: d.iso8601, active: active[d].to_i, expenses: expenses[d].to_i } }
    end

    def one_on_one_count
      Household.where(kind: "group").joins(:members).where(members: { left_at: nil })
               .group("households.id").having("count(*) = 2").count.size
    end

    def short_name(u) = [u.first_name.presence || "No name", u.last_name.to_s[0]&.then { |c| "#{c}." }].compact.join(" ")

    def how_joined(u)
      provider = u.identities.order(:created_at).first&.provider
      via = { "phone" => "Phone", "email" => "Email", "apple" => "Apple", "google" => "Google" }[provider] || "Account"
      first = u.members.order(:created_at).first&.household
      what = if first.nil? then "no tab yet"
             elsif first.kind == "home" then "a home"
             elsif first.members.count <= 2 then "a one-on-one"
             else "a group"
             end
      "#{via} · #{what}"
    end

    # Things worth a look, most serious first.
    def attention
      list = []
      if Hometab::Switches.paused?
        list << { level: "bad", title: "Gloslate is paused", detail: Hometab::Switches.pause["message"] }
      end
      list << { level: "warn", title: "Read-only mode is on", detail: "People can look but not change anything" } if Hometab::Switches.read_only?
      off = Hometab::Switches.features.reject { |_, on| on }.keys
      list << { level: "warn", title: "Turned off: #{off.map { |k| Hometab::Switches::FEATURES[k] }.join(', ')}", detail: "Server → Switches" } if off.any?
      disputed = Payment.where(status: "disputed", disputed_at: 7.days.ago..).count
      list << { level: "bad", title: "#{disputed} #{disputed == 1 ? 'payment' : 'payments'} disputed this week", detail: "Someone said a payment didn't arrive" } if disputed.positive?
      failed = Control::Machine.jobs&.dig(:failed).to_i
      list << { level: "bad", title: "#{failed} background #{failed == 1 ? 'job' : 'jobs'} failed", detail: "Server → Retry failed jobs" } if failed.positive?
      outage = UptimeEvent.where(kind: "outage", started_at: 1.day.ago..).order(started_at: :desc).first
      list << { level: "bad", title: "Down for #{(outage.seconds / 60.0).ceil} min in the last day", detail: outage.started_at.in_time_zone(ZONE).strftime("%b %-d, %-l:%M %p") } if outage
      locked = User.where.not(locked_at: nil).count
      list << { level: "info", title: "#{locked} locked #{locked == 1 ? 'account' : 'accounts'}", detail: "Accounts → Locked" } if locked.positive?
      cert = Control::Machine.certificate
      list << { level: "warn", title: "Certificate renews in #{cert[:days_left]} days", detail: cert[:host] } if cert && cert[:days_left] < 20
      list
    end

    # ---- Insights ----

    def insights(days: 30)
      from = today - (days - 1)
      {
        days:,
        active: active_counts,
        daily: (from..today).map { |d| { day: d.iso8601, active: active_on(d) } },
        funnel: funnel(from),
        cohorts: cohorts,
        features: features(from),
        platforms: platforms(from),
        settle_times: settle_times(from),
        money: money(from)
      }
    end

    def active_on(day) = (@active_cache ||= {})[day] ||= ActiveDay.where(day:).count

    def active_counts
      { day: ActiveDay.where(day: today).count,
        week: ActiveDay.where(day: (today - 6)..).distinct.count(:user_id),
        month: ActiveDay.where(day: (today - 29)..).distinct.count(:user_id) }
    end

    # Of the people who signed up in the period: how far they got.
    def funnel(from)
      users = User.active.where(created_at: day_start(from)..)
      ids = users.pluck(:id)
      return [] if ids.empty?

      member_ids = Member.where(user_id: ids)
      in_tab = member_ids.distinct.count(:user_id)
      added = Expense.joins("JOIN members ON members.id = expenses.created_by_id").where(members: { user_id: ids }).distinct.count("members.user_id")
      settled = Payment.counted.joins("JOIN members ON members.id IN (payments.from_member_id, payments.to_member_id)")
                       .where(members: { user_id: ids }).distinct.count("members.user_id")
      came_back = users.where(created_at: ..7.days.ago).joins("JOIN active_days ON active_days.user_id = users.id AND active_days.day >= (users.created_at AT TIME ZONE 'UTC' AT TIME ZONE '#{ZONE}')::date + 7")
                       .distinct.count("users.id")
      old_enough = users.where(created_at: ..7.days.ago).count
      [
        { step: "Signed up", count: ids.size, of: ids.size },
        { step: "Joined or started a tab", count: in_tab, of: ids.size },
        { step: "Added an expense", count: added, of: ids.size },
        { step: "Settled up once", count: settled, of: ids.size },
        { step: "Came back after a week", count: came_back, of: old_enough }
      ]
    end

    # Weekly sign-up groups: % of each group active in each later week.
    def cohorts(weeks: 6)
      start = today.beginning_of_week(:monday)
      (0...weeks).map do |i|
        week = start - (weeks - 1 - i).weeks
        ids = User.active.where(created_at: day_start(week)...day_start(week + 7)).pluck(:id)
        cells = (1..4).map do |n|
          w = week + n.weeks
          next nil if w > today || ids.empty?

          (100.0 * ActiveDay.where(user_id: ids, day: w...(w + 7)).distinct.count(:user_id) / ids.size).round
        end
        { week: week.iso8601, people: ids.size, weeks: cells }
      end
    end

    FEATURE_EVENTS = {
      "expense_added" => "Added an expense", "request_sent" => "Sent a request", "payment_marked" => "Marked a payment",
      "payment_confirmed" => "Confirmed a payment", "household_created" => "Started a home or group", "group_created" => "Started a group",
      "member_joined" => "Joined from an invite", "request_page_viewed" => "Opened a request link", "statement_generated" => "Got a statement"
    }.freeze

    def features(from)
      counts = AnalyticsEvent.where(created_at: day_start(from)..).group(:name).distinct.count(:user_id)
      rows = FEATURE_EVENTS.map { |k, label| { key: k, label:, people: counts[k].to_i } }
      rows << { key: "friends", label: "Added a friend", people: Friendship.where(created_at: day_start(from)..).distinct.count(:user_id) }
      rows.sort_by { -_1[:people] }
    end

    def platforms(from)
      rows = ActiveDay.where(day: from..).where.not(platform: nil).group(:platform).distinct.count(:user_id)
      total = rows.values.sum
      versions = Session.where(last_seen_at: day_start(from)..).where.not(app_version: nil).group(:platform, :app_version).count
      rows.sort_by { -_2 }.map do |platform, n|
        top = versions.select { |(p, _), _| p == platform }.max_by { _2 }
        { platform:, people: n, percent: total.zero? ? 0 : (100.0 * n / total).round, top_version: top&.first&.last }
      end
    end

    # Median hours: request sent → payment marked, marked → confirmed.
    def settle_times(from)
      marked = Payment.where(marked_at: day_start(from)..).where.not(confirmed_at: nil)
      confirm = marked.pluck(Arel.sql("EXTRACT(EPOCH FROM (confirmed_at - marked_at)) / 3600"))
      req = PaymentRequest.where(created_at: day_start(from)..).joins("JOIN payments ON payments.household_id = payment_requests.household_id AND payments.from_member_id = payment_requests.recipient_id AND payments.marked_at > payment_requests.created_at")
                          .group("payment_requests.id").pluck(Arel.sql("EXTRACT(EPOCH FROM (min(payments.marked_at) - payment_requests.created_at)) / 3600"))
      { request_to_marked_hours: median(req), marked_to_confirmed_hours: median(confirm) }
    rescue ActiveRecord::StatementInvalid
      { request_to_marked_hours: nil, marked_to_confirmed_hours: nil }
    end

    def money(from)
      { expenses_cents: Expense.active.where(created_at: day_start(from)..).sum(:amount_cents),
        expenses: Expense.active.where(created_at: day_start(from)..).count,
        confirmed_cents: Payment.counted.where(confirmed_at: day_start(from)..).sum(:amount_cents) }
    end

    def median(values)
      v = values.compact.map(&:to_f).sort
      return nil if v.empty?

      ((v[(v.size - 1) / 2] + v[v.size / 2]) / 2.0).round(1)
    end
  end
end
