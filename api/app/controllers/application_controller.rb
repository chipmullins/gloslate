class ApplicationController < ActionController::API
  # Later handlers win, so the subclass (Forbidden) comes after Error.
  rescue_from Hometab::Error do |e| render json: { error: e.message }, status: :unprocessable_content end
  rescue_from Hometab::Forbidden do |e| render json: { error: e.message }, status: :forbidden end
  rescue_from ActiveRecord::RecordNotFound do render json: { error: "Not found" }, status: :not_found end
  rescue_from ActiveRecord::RecordInvalid do |e| render json: { error: e.record.errors.full_messages.first }, status: :unprocessable_content end
  rescue_from ActionController::ParameterMissing do |e| render json: { error: e.message }, status: :bad_request end

  # Profile photo links (Disk service in dev/test needs a host; S3 ignores it).
  before_action { ActiveStorage::Current.url_options = { host: request.base_url } }

  private

  def bearer_token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
end
