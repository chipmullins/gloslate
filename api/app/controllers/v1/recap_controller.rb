module V1
  # GET /v1/recap?year=2026 → your year on the slate (Recaps::Year). Defaults to this year.
  class RecapController < BaseController
    def show
      render json: { data: Recaps::Year.call(current_user, year) }
    end

    # GET /v1/recap/image.png?year=2026 → the share card (Recaps::Image).
    def image
      send_data Recaps::Image.png(Recaps::Year.call(current_user, year)), type: "image/png", disposition: "inline", filename: "gloslate-#{year}.png"
    end

    private

    def year
      y = params[:year].present? ? Integer(params[:year], exception: false) : Time.current.year
      raise Hometab::Error, "That year doesn't look right" unless y && (2020..Time.current.year).cover?(y)

      y
    end
  end
end
