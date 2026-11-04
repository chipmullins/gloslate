class ApplicationController < ActionController::API
  # Later handlers win, so the subclass (Forbidden) comes after Error.
  rescue_from Hometab::Error do |e| render json: { error: e.message }, status: :unprocessable_content end
  rescue_from Hometab::Forbidden do |e| render json: { error: e.message }, status: :forbidden end
  rescue_from ActiveRecord::RecordNotFound do render json: { error: "Not found" }, status: :not_found end
  rescue_from ActionController::ParameterMissing do |e| render json: { error: e.message }, status: :bad_request end

  private

  def bearer_token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
end
