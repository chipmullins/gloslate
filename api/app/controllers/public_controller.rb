# Server-rendered pages non-users see: request pages, invite landing, home page.
class PublicController < ActionController::Base
  layout "public"
  skip_forgery_protection # no sessions in this app; the "I paid" form only creates a pending payment the requester must confirm
  helper_method :money

  PUBLIC_METHODS = %w[venmo cashapp zelle cash other].freeze
  rate_limit to: 5, within: 10.minutes, only: :mark_paid, name: "mark-paid", by: -> { "#{request.remote_ip}:#{params[:token]}" },
             with: -> { redirect_to "/r/#{params[:token]}", status: :see_other }
  rate_limit to: 60, within: 1.minute, only: %i[request_page request_image invite], name: "pages"

  def money(cents) = Hometab::Money.format(cents)

  # Marketing site pages (gloslate.app). Static, so they can be cached briefly.
  def privacy = render_site
  def terms = render_site
  def support = render_site

  def sitemap
    base = ENV.fetch("PUBLIC_URL", "https://gloslate.app")
    urls = ["/", "/support", "/privacy", "/terms"].map { |p| "<url><loc>#{base}#{p == '/' ? '/' : p}</loc></url>" }.join
    render xml: %(<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">#{urls}</urlset>)
  end

  def request_page
    @req = PaymentRequest.includes(:requester, :recipient, :household).find_by!(token: params[:token])
    unless request.headers["Purpose"] == "prefetch" || request.user_agent.to_s.match?(/bot|preview|facebookexternalhit|Slack|Twitter/i)
      @req.update_columns(views: @req.views + 1, first_viewed_at: @req.first_viewed_at || Time.current)
      AnalyticsEvent.track("request_page_viewed", household: @req.household)
    end
    @current = @req.current_cents
    @pay_amount = [@current, 0].max
    @links = @pay_amount.positive? ? Payments::PayLinks.call(to: @req.requester, amount_cents: @pay_amount, memo: "Gloslate · #{@req.household.name}")[:links] : {}
    @marked = params[:marked].present?
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
  rescue ActiveRecord::RecordNotFound
    render :missing, status: :not_found
  end

  # "Already paid? Let Chip know" — works without an account.
  def mark_paid
    req = PaymentRequest.find_by!(token: params[:token])
    owed = [req.current_cents, 0].max
    cents = Hometab::Money.parse(params[:amount].to_s) || owed
    cents = [cents, owed].min # can't mark more than is actually owed
    return redirect_to("/r/#{req.token}", status: :see_other) unless cents.positive?

    method = PUBLIC_METHODS.include?(params[:method]) ? params[:method] : "other"
    unless req.household.payments.pending.where(from_member: req.recipient, to_member: req.requester).where(marked_at: 10.minutes.ago..).exists?
      # Anyone with the link could submit this, so it waits for the requester:
      # it never confirms itself.
      Payments::Mark.call(household: req.household, actor: req.recipient, from: req.recipient, to: req.requester,
                          amount_cents: cents, method:, note: "Marked from the request page", auto_confirm: false)
      req.update!(paid_marked_at: Time.current)
    end
    redirect_to "/r/#{req.token}?marked=1", status: :see_other
  rescue Hometab::Error
    # Usually "already marked and waiting": show the same "we told them" state.
    waiting = req&.household&.payments&.pending&.where(from_member: req.recipient, to_member: req.requester)&.exists?
    redirect_to "/r/#{params[:token]}#{'?marked=1' if waiting}", status: :see_other
  end

  def request_image
    req = PaymentRequest.includes(:requester, :recipient).find_by!(token: params[:token])
    expires_in 1.day, public: true
    png = Rails.cache.fetch(["request-image", req.id, req.updated_at.to_i], expires_in: 1.day) { Requests::Image.png(req) }
    send_data png, type: "image/png", disposition: "inline"
  end

  def invite
    @invite = Invite.includes(:household, :created_by).find_by(token: params[:token])
    render status: @invite ? :ok : :not_found
  end

  def home; end

  # Universal links: invites (/i/...) open the app when it's installed.
  def apple_app_site_association
    team = ENV["APPLE_TEAM_ID"]
    return head(:not_found) if team.blank?

    render json: { applinks: { details: [{ appIDs: ["#{team}.app.tabitat"], components: [{ "/" => "/i/*" }] }] } }
  end

  def asset_links
    sha = ENV["ANDROID_CERT_SHA256"]
    return head(:not_found) if sha.blank?

    render json: [{ relation: ["delegate_permission/common.handle_all_urls"],
                    target: { namespace: "android_app", package_name: "app.tabitat", sha256_cert_fingerprints: sha.split(",") } }]
  end

  FONTS = Dir[Rails.root.join("app/assets/fonts/*.ttf")].to_h { [File.basename(_1), _1] }.freeze
  def font
    path = FONTS[params[:name]] or return head(:not_found)
    expires_in 1.year, public: true
    send_file path, type: "font/ttf", disposition: "inline"
  end

  def icon
    expires_in 1.week, public: true
    # Favicons show at 16-32px: use the mark's simplified small drawing (it scales, being SVG).
    render plain: render_to_string(partial: "public/mark", formats: [:html], locals: { size: 36 }), content_type: "image/svg+xml"
  end

  private

  def render_site
    expires_in 10.minutes, public: true
    render action_name
  end
end
