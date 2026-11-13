module V1
  class MeController < BaseController
    def show = render(json: current_user.as_api_json)

    # POST /v1/me/photo multipart { file }   — a photo from the camera or library
    # POST /v1/me/photo { from: "glofly" }    — the photo from the person's Glofly account
    def upload_photo
      if params[:from] == "glofly"
        url = current_user.glofly_picture_url or raise Hometab::Error, "Sign in with Glofly first to use your Glofly photo"
        io, type = fetch_image(url)
        current_user.photo.attach(io:, filename: "glofly.#{type.split('/').last}", content_type: type)
      else
        file = params.require(:file)
        raise Hometab::Error, "Profile photos can be a JPEG, PNG, WebP or HEIC" unless User::PHOTO_TYPES.include?(file.content_type)
        raise Hometab::Error, "That photo is too big (8 MB max)" if file.size > User::PHOTO_MAX
        current_user.photo.attach(file)
      end
      current_user.touch
      render json: current_user.as_api_json
    end

    def remove_photo
      current_user.photo.purge_later if current_user.photo.attached?
      current_user.touch
      render json: current_user.reload.as_api_json
    end

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


    # Downloads Glofly's photo (https only, image types only, 8 MB cap, short timeouts).
    def fetch_image(url)
      uri = URI(url)
      raise Hometab::Error, "Couldn't get your Glofly photo" unless uri.is_a?(URI::HTTPS)

      res = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) { |h| h.get(uri.request_uri) }
      type = res["Content-Type"].to_s.split(";").first
      unless res.is_a?(Net::HTTPSuccess) && User::PHOTO_TYPES.include?(type) && res.body.bytesize <= User::PHOTO_MAX
        raise Hometab::Error, "Couldn't get your Glofly photo"
      end

      [StringIO.new(res.body), type]
    rescue SocketError, Timeout::Error, OpenSSL::SSL::SSLError, Errno::ECONNREFUSED
      raise Hometab::Error, "Couldn't reach Glofly. Try again in a bit."
    end
  end
end
