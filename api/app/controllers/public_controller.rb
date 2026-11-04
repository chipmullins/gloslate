# Server-rendered pages non-users see: request pages, invite landing, home page.
class PublicController < ActionController::Base
  layout "public"
  skip_forgery_protection # no sessions in this app; the "I paid" form only creates a pending payment the requester must confirm
  helper_method :money

  def money(cents) = Hometab::Money.format(cents)

  def request_page
    @req = PaymentRequest.includes(:requester, :recipient, :household).find_by!(token: params[:token])
    unless request.headers["Purpose"] == "prefetch" || request.user_agent.to_s.match?(/bot|preview|facebookexternalhit|Slack|Twitter/i)
      @req.update_columns(views: @req.views + 1, first_viewed_at: @req.first_viewed_at || Time.current)
      AnalyticsEvent.track("request_page_viewed", household: @req.household)
    end
    @current = @req.current_cents
    @pay_amount = [@current, 0].max
    @links = @pay_amount.positive? ? Payments::PayLinks.call(to: @req.requester, amount_cents: @pay_amount, memo: "HomeTab · #{@req.household.name}")[:links] : {}
    @marked = params[:marked].present?
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
  rescue ActiveRecord::RecordNotFound
    render :missing, status: :not_found
  end

  # "Already paid? Let Chip know" — works without an account.
  def mark_paid
    req = PaymentRequest.find_by!(token: params[:token])
    cents = Hometab::Money.parse(params[:amount].to_s) || req.amount_cents
    method = Payment::METHODS.include?(params[:method]) ? params[:method] : "other"
    unless req.household.payments.pending.where(from_member: req.recipient, to_member: req.requester).where(marked_at: 10.minutes.ago..).exists?
      Payments::Mark.call(household: req.household, actor: req.recipient, from: req.recipient, to: req.requester,
                          amount_cents: cents, method:, note: "Marked from the request page")
      req.update!(paid_marked_at: Time.current)
    end
    redirect_to "/r/#{req.token}?marked=1", status: :see_other
  rescue Hometab::Error => e
    redirect_to "/r/#{params[:token]}", status: :see_other
  end

  def request_image
    req = PaymentRequest.includes(:requester, :recipient).find_by!(token: params[:token])
    expires_in 1.day, public: true
    send_data Requests::Image.png(req), type: "image/png", disposition: "inline"
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

    render json: { applinks: { details: [{ appIDs: ["#{team}.app.hometab"], components: [{ "/" => "/i/*" }] }] } }
  end

  def asset_links
    sha = ENV["ANDROID_CERT_SHA256"]
    return head(:not_found) if sha.blank?

    render json: [{ relation: ["delegate_permission/common.handle_all_urls"],
                    target: { namespace: "android_app", package_name: "app.hometab", sha256_cert_fingerprints: sha.split(",") } }]
  end

  FONTS = Dir[Rails.root.join("app/assets/fonts/*.ttf")].to_h { [File.basename(_1), _1] }.freeze
  def font
    path = FONTS[params[:name]] or return head(:not_found)
    expires_in 1.year, public: true
    send_file path, type: "font/ttf", disposition: "inline"
  end

  def icon
    expires_in 1.week, public: true
    render inline: render_to_string(partial: "public/mark", locals: { size: 100 }), content_type: "image/svg+xml"
  end
end
