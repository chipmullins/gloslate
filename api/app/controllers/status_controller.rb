# GET /status — is Gloslate paused or read-only? Apps poll this while they
# show the paused screen. Always answers, even while paused.
class StatusController < ActionController::API
  def show
    p = Hometab::Switches.pause
    r = Hometab::Switches.read_only
    response.headers["Cache-Control"] = "no-store"
    render json: { paused: p["on"] == true, message: p["message"], since: p["since"],
                   read_only: r["on"] == true, read_only_message: r["message"] }
  end
end
