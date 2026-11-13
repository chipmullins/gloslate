require "test_helper"

class RecapTest < ActionDispatch::IntegrationTest
  setup do
    @t = sign_in_by_phone["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex"], name: "Maple St" }, headers: auth(@t), as: :json
    @h = json["data"]["id"]
    @me = json["data"]["members"].find { _1["you"] }["id"]
  end

  test "counts what you split this year and never who paid more" do
    year = Time.current.year
    2.times { post "/v1/households/#{@h}/expenses", params: { amount_cents: 4000, payer_id: @me, category: "groceries", spent_on: "#{year}-01-01" }, headers: auth(@t), as: :json }
    post "/v1/households/#{@h}/expenses", params: { amount_cents: 1000, payer_id: @me, spent_on: "#{year - 1}-12-30" }, headers: auth(@t), as: :json

    get "/v1/recap", params: { year: }, headers: auth(@t)
    assert_response :success
    d = json["data"]
    assert_equal 2, d["things_split"]
    assert_equal "groceries", d["top_category"]["category"]
    assert_equal 1, d["busiest_month"]["month"]
    assert_equal ["Alex"], d["people"]
    assert_equal 1, d["places"].size
    refute d.to_json.include?("cents"), "the recap never shows balances or who paid"

    get "/v1/recap/image.png", params: { year: }, headers: auth(@t)
    assert_response :success
    assert_equal "image/png", response.media_type

    get "/v1/recap", params: { year: 1999 }, headers: auth(@t)
    assert_response :unprocessable_content
  end
end
