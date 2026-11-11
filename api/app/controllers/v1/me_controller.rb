module V1
  class MeController < BaseController
    def show = render(json: current_user.as_api_json)

    # GET /v1/me/export — all my data as JSON
    def export
      send_data Accounts::Export.call(current_user).to_json, type: "application/json", filename: "gloslate-my-data.json"
    end

    # DELETE /v1/me { confirm: "DELETE" }
    def destroy
      raise Hometab::Error, "Type DELETE to confirm" unless params[:confirm] == "DELETE"

      Accounts::Delete.call(current_user)
      head :no_content
    end

    # Names, time zone, quiet hours, Face ID lock, notification choices, onboarding done.
    def update
      attrs = params.permit(:first_name, :last_name, :time_zone, :quiet_start_hour, :quiet_end_hour, :face_id_lock, :celebration_style)
      if attrs[:time_zone] && !ActiveSupport::TimeZone[attrs[:time_zone]]
        raise Hometab::Error, "Unknown time zone"
      end
      %i[quiet_start_hour quiet_end_hour].each do |k|
        next unless attrs.key?(k)
        raise Hometab::Error, "Hours go from 0 to 23" unless (0..23).cover?(attrs[k].to_i)
      end
      if params[:notification_prefs].is_a?(ActionController::Parameters)
        prefs = params[:notification_prefs].permit(*Notifications::Notify::OPTIONAL).to_h
        bad = prefs.values - %w[on off daily]
        raise Hometab::Error, "Choices are on, off or daily" if bad.any?
        attrs[:notification_prefs] = current_user.notification_prefs.merge(prefs)
      end
      # Finished onboarding (any path, including "just friends"). Set once, never cleared.
      attrs[:onboarded_at] = Time.current if ActiveModel::Type::Boolean.new.cast(params[:onboarded]) && current_user.onboarded_at.nil?
      current_user.update!(attrs)
      update_memberships!
      render json: current_user.as_api_json
    end

    private

    # How people pay you and your reminder settings live on each tab you're
    # in; { member: {...} } sets them everywhere at once (for people with no
    # home, only one-on-ones and groups). Logged in each tab like any change.
    MEMBER_SETTINGS = %i[venmo_handle cashtag zelle_contact auto_remind remind_threshold_cents remind_after_days reminder_tone].freeze

    def update_memberships!
      return unless params[:member].is_a?(ActionController::Parameters)

      attrs = params[:member].permit(*MEMBER_SETTINGS)
      return if attrs.empty?

      Member.transaction do
        current_user.members.current.includes(:household).find_each do |m|
          before = m.slice(*attrs.keys)
          m.update!(attrs)
          next if before == m.slice(*attrs.keys)

          LedgerEvent.record!(household: m.household, kind: "member.updated", subject: m, actor: m,
                              data: { before:, after: m.slice(*attrs.keys) })
        end
      end
    end
  end
end
