module V1
  class MeController < BaseController
    def show = render(json: current_user.as_api_json)

    # GET /v1/me/export — all my data as JSON
    def export
      send_data Accounts::Export.call(current_user).to_json, type: "application/json", filename: "hometab-my-data.json"
    end

    # DELETE /v1/me { confirm: "DELETE" }
    def destroy
      raise Hometab::Error, "Type DELETE to confirm" unless params[:confirm] == "DELETE"

      Accounts::Delete.call(current_user)
      head :no_content
    end

    # Names, time zone, quiet hours, Face ID lock, notification choices.
    def update
      attrs = params.permit(:first_name, :last_name, :time_zone, :quiet_start_hour, :quiet_end_hour, :face_id_lock)
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
      current_user.update!(attrs)
      render json: current_user.as_api_json
    end
  end
end
