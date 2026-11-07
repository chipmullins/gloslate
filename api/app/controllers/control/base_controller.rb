module Control
  # Gloslate Control: the staff console, as server-rendered pages.
  #
  # Security:
  # - Staff are a separate realm (staff_users), never app accounts.
  # - Signing in needs a password AND an authenticator code; a session lasts
  #   12 hours. The session token lives in an encrypted, httpOnly, SameSite=Strict
  #   cookie scoped to /control, so page scripts and other sites never see it.
  # - Every form carries a token derived from that session (checked on every
  #   change), on top of SameSite.
  # - No JavaScript at all: the pages' Content-Security-Policy blocks scripts.
  # - Every look at personal data and every change is written to the audit log,
  #   and changes need a reason.
  class BaseController < ActionController::Base
    include ActionController::Cookies

    COOKIE = :gloslate_control
    layout "control"
    skip_forgery_protection # our own per-session form token below (no Rails session store in this app)
    around_action :time_page
    before_action :secure_headers
    before_action :take_flash
    before_action :authenticate!
    before_action :check_form_token!, unless: -> { request.get? || request.head? }
    helper_method :page_ms, :page_parts, :flash_message, :current_staff_session_expires, :current_staff, :form_token, :mask, :money, :at_least?, :local_time, :ago, :nav

    rescue_from Hometab::Error, Hometab::Forbidden do |e|
      flash_next(:alert, e.message)
      redirect_back_or_to control_root_path, status: :see_other
    end
    rescue_from ActiveRecord::RecordNotFound do
      render "control/shared/not_found", status: :not_found
    end
    rescue_from ActiveRecord::RecordInvalid do |e|
      flash_next(:alert, e.record.errors.full_messages.first)
      redirect_back_or_to control_root_path, status: :see_other
    end
    rescue_from ActionController::ParameterMissing do |e|
      flash_next(:alert, "Missing: #{e.param}")
      redirect_back_or_to control_root_path, status: :see_other
    end

    private

    attr_reader :current_staff, :current_staff_session

    def authenticate!
      @current_staff_session = StaffSession.authenticate(cookies.encrypted[COOKIE])
      @current_staff = @current_staff_session&.staff_user
      return if @current_staff&.active?

      cookies.delete(COOKIE, path: "/control")
      redirect_to control_sign_in_path, status: :see_other
    end

    def sign_in_cookie!(token)
      cookies.encrypted[COOKIE] = { value: token, httponly: true, secure: Rails.env.production?, same_site: :strict,
                                    path: "/control", expires: StaffSession::TTL.from_now }
    end

    # A per-session secret every form posts back (HMAC of the session id).
    def form_token
      return "" unless current_staff_session

      OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "control-form:#{current_staff_session.id}")
    end

    def check_form_token!
      ok = params[:form_token].present? && ActiveSupport::SecurityUtils.secure_compare(params[:form_token].to_s, form_token)
      raise Hometab::Forbidden, "That form expired. Try again." unless ok
    end

    def secure_headers
      response.headers["Content-Security-Policy"] = "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; " \
                                                    "form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
      response.headers["X-Frame-Options"] = "DENY"
      response.headers["Referrer-Policy"] = "no-referrer"
      response.headers["Cache-Control"] = "no-store"
      response.headers["X-Robots-Tag"] = "noindex, nofollow"
    end

    # How long the page took on the server (shown small at the bottom, and as
    # a Server-Timing header), so slowness can be told apart from the network.
    def time_page
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      @page_started = started
      yield
    ensure
      ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round
      response.headers["Server-Timing"] = ([["app", ms]] + (@parts || {}).to_a).map { |k, v| "#{k};dur=#{v}" }.join(", ")
    end

    # Times one part of a page (shown with the page time, for finding slow parts).
    def timed(name)
      t = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      yield
    ensure
      (@parts ||= {})[name] = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - t) * 1000).round
    end

    def page_parts = (@parts || {}).select { |_, ms| ms >= 20 }.map { |k, ms| "#{k} #{ms}" }.join(", ")

    def page_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - @page_started) * 1000).round

    def at_least?(role) = current_staff&.at_least?(role)
    def current_staff_session_expires = current_staff_session&.expires_at

    def require_role!(role)
      return if at_least?(role)

      audit!("denied.#{controller_name}.#{action_name}")
      raise Hometab::Forbidden, "Your role (#{current_staff.role}) can't do that"
    end

    def require_reason!
      r = params[:reason].to_s.strip
      raise Hometab::Error, "Give a reason (it goes in the audit log)" if r.length < 5

      r[0, 500]
    end

    # The authenticator code again, for the biggest switches.
    def require_fresh_code!
      raise Hometab::Error, "That authenticator code didn't work" unless current_staff.verify_otp!(params[:otp].to_s.gsub(/\s/, ""))
    end

    def audit!(action, target: nil, reason: nil, staff: current_staff)
      AdminAuditEvent.create!(staff_user_id: staff&.id, action:, target_type: target&.class&.name, target_id: target&.id,
                              reason:, params: AdminAuditEvent.redact(params.permit!.except(:form_token)).merge("via" => "control"),
                              ip: request.remote_ip, user_agent: request.user_agent.to_s[0, 255])
    end

    def done(message, to: nil)
      flash_next(:notice, message)
      redirect_to(to || request.referer || control_root_path, status: :see_other)
    end

    # A one-time message for the next page (no session store in this app: a
    # short encrypted cookie instead).
    def flash_next(kind, text)
      cookies.encrypted[:control_flash] = { value: { "kind" => kind.to_s, "text" => text.to_s[0, 300] }.to_json,
                                            httponly: true, secure: Rails.env.production?, same_site: :strict, path: "/control" }
    end

    def take_flash
      raw = cookies.encrypted[:control_flash]
      return unless raw

      cookies.delete(:control_flash, path: "/control")
      @flash_message = JSON.parse(raw) rescue nil
    end

    def flash_message = @flash_message

    # Viewers see money and activity but not contact details. Phone numbers
    # read as (859) 555-0101.
    def mask(value)
      return value if value.blank?

      value = value.to_s.sub(/\A\+1(\d{3})(\d{3})(\d{4})\z/, '(\1) \2-\3')
      return value if at_least?(:support)

      return value.sub(/\A(.).*(@.*)\z/, '\1•••\2') if value.include?("@")

      digits = value.count("0-9")
      seen = 0
      value.gsub(/\d/) { |d| (seen += 1) > digits - 2 ? d : "•" } # only the last two digits show
    end

    def money(cents) = Hometab::Money.format(cents.to_i)
    def local_time(t, fmt = "%b %-d, %-l:%M %p") = t && t.in_time_zone(ActiveDay::ZONE).strftime(fmt)

    def ago(t)
      return "never" unless t

      s = (Time.current - t).to_i
      return "just now" if s < 60
      return "#{s / 60}m ago" if s < 3600
      return "#{s / 3600}h ago" if s < 86_400

      "#{s / 86_400}d ago"
    end

    NAV = [
      %w[dashboard Dashboard /control M4\ 13h6V4H4zM14\ 20h6v-9h-6zM4\ 20h6v-3H4zM14\ 7h6V4h-6z],
      %w[accounts Accounts /control/accounts M9\ 11a4\ 4\ 0\ 100-8\ 4\ 4\ 0\ 000\ 8zM2\ 21a7\ 7\ 0\ 0114\ 0M17\ 11a3\ 3\ 0\ 100-6M22\ 21a6\ 6\ 0\ 00-4-5.6],
      %w[insights Insights /control/insights M4\ 20V10M10\ 20V4M16\ 20v-7M22\ 20H2],
      %w[tabs Tabs /control/tabs M4\ 11l8-7\ 8\ 7v9a1\ 1\ 0\ 01-1\ 1h-4v-6h-6v6H5a1\ 1\ 0\ 01-1-1z],
      %w[server Server /control/server M4\ 5h16v6H4zM4\ 13h16v6H4zM8\ 8h.01M8\ 16h.01],
      %w[audit Audit\ log /control/audit M6\ 3h9l4\ 4v14H6zM14\ 3v5h5M9\ 13h7M9\ 17h7]
    ].freeze

    def nav = NAV
  end
end
