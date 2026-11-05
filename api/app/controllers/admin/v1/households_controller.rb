module Admin
  module V1
    class HouseholdsController < BaseController
      def show
        h = Household.find(params[:id])
        audit!("households.show", target: h)
        render json: { data: {
          id: h.id, name: h.name, created_at: h.created_at, statement_day: h.statement_day, simplify_debts: h.simplify_debts,
          members: h.members.map { |m| { id: m.id, name: m.display_name, user_id: m.user_id, placeholder: m.placeholder?,
                                         moved_in_on: m.moved_in_on, moved_out_on: m.moved_out_on, left_at: m.left_at } },
          debts: h.debts.map { |d| { from: d.debtor, to: d.creditor, cents: d.cents } }
        } }
      end

      # Read-only event stream. Staff can't edit balances.
      def ledger
        h = Household.find(params[:id])
        rows, meta = page_meta(h.ledger_events.order(occurred_at: :desc))
        audit!("households.ledger", target: h)
        render json: { data: rows.as_json(except: %i[household_id]), meta: }
      end
    end
  end
end
