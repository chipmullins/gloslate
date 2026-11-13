require "test_helper"

class HistoryTest < ActionDispatch::IntegrationTest
  test "search by text, category and person; statements list; csv download" do
    t = sign_in_by_phone["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex", "Maya"] }, headers: auth(t), as: :json
    h = json["data"]["id"]
    me = json["data"]["me"]["id"]
    maya = json["data"]["members"].find { _1["display_name"] == "Maya" }["id"]
    post "/v1/households/#{h}/expenses", params: { amount_cents: 3000, payer_id: me, description: "Pizza night", category: "food" }, headers: auth(t), as: :json
    post "/v1/households/#{h}/expenses", params: { amount_cents: 9000, payer_id: me, description: "Costco run", category: "groceries", participant_ids: [me, maya] }, headers: auth(t), as: :json

    get "/v1/households/#{h}/history", params: { q: "pizza" }, headers: auth(t)
    assert_equal ["Pizza night"], json["data"].map { _1["description"] }
    get "/v1/households/#{h}/history", params: { category: "groceries" }, headers: auth(t)
    assert_equal ["Costco run"], json["data"].map { _1["description"] }
    get "/v1/households/#{h}/history", params: { month: Date.current.strftime("%Y-%m") }, headers: auth(t)
    assert_equal 2, json["data"].size
    # Totals cover everything that matches, with your share.
    get "/v1/households/#{h}/history", params: { year: Date.current.year }, headers: auth(t)
    assert_equal({ "count" => 2, "total_cents" => 12000, "my_share_cents" => 1000 + 4500 }, json["meta"]["totals"])
    get "/v1/households/#{h}/history", params: { year: Date.current.year - 1 }, headers: auth(t)
    assert_equal 0, json["meta"]["totals"]["count"]

    get "/v1/households/#{h}/export", params: { year: Date.current.year }, headers: auth(t)
    assert_equal "text/csv", response.media_type
    assert_includes response.body, "Costco run"
    get "/v1/households/#{h}/statements", headers: auth(t)
    assert_equal [], json["data"]

    s = Statements::Generate.build(Household.find(h), Date.current.beginning_of_month, Date.current.end_of_month)
    get "/v1/statements/#{s.id}", headers: auth(t)
    assert_response :success
    assert_equal s.title, json["data"]["title"]
    get "/v1/statements/#{s.id}.pdf", headers: auth(t)
    assert_equal "application/pdf", response.media_type
    other = sign_in_by_phone("8595550999")["token"]
    get "/v1/statements/#{s.id}", headers: auth(other)
    assert_response :not_found
    get "/icon.svg"
    assert_equal "image/svg+xml", response.media_type
  end
end
