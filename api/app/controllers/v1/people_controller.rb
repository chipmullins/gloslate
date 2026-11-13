module V1
  # Netting across tabs: one number per person, however many tabs you share.
  class PeopleController < BaseController
    rate_limit to: 10, within: 1.hour, only: :request_net, name: "net_requests", by: -> { current_user.id },
               with: -> { render json: { error: "That's a lot of requests. Try again in a bit." }, status: :too_many_requests }

    # GET /v1/people: everyone you share a tab with who has a Gloslate account.
    def index
      rows = People::Net.all(current_user).sort_by { -_1[:net_cents].abs }
      render json: { data: rows.map { People::Net.as_json(_1) } }
    end

    # GET /v1/people/:id: the net with one person and the tab-by-tab breakdown.
    def show
      render json: { data: People::Net.as_json(People::Net.with(current_user, params[:id])) }
    end

    # POST /v1/people/:id/settle { method }: record the net as paid, one payment per tab.
    def settle
      payments = People::Settle.call(user: current_user, other_id: params[:id], method: params.fetch(:method, "other"))
      render json: { data: People::Net.as_json(People::Net.with(current_user, params[:id])), payments: payments.size }, status: :created
    end

    # POST /v1/people/:id/request: ask for the net amount in the app, in your reminder tone.
    def request_net
      row = People::Net.with(current_user, params[:id])
      raise Hometab::Error, "#{People::Net.name(row)} doesn't owe you anything overall" unless row[:net_cents].positive?

      tab = row[:tabs].max_by { _1[:cents] }
      tone = current_user.members.current.order(updated_at: :desc).pick(:reminder_tone)
      amount = Hometab::Money.format(row[:net_cents])
      push = Requests::Tone.request_push(tone, from: tab[:me].first_name, amount:)
      Notifications::Notify.call(member: tab[:them], kind: "request_received", title: push[:title],
                                 body: row[:tabs].count { !_1[:cents].zero? } > 1 ? "Across your shared tabs. #{push[:body]}" : push[:body],
                                 route: "/people/#{current_user.id}")
      head :no_content
    end
  end
end
