require "test_helper"

class ReceiptsTest < ActionDispatch::IntegrationTest
  setup do
    @t = sign_in_by_phone["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex", "Maya"] }, headers: auth(@t), as: :json
    @h = json["data"]["id"]
    @ids = json["data"]["members"].map { _1["id"] }
  end

  test "itemized receipt is stored as exact amounts plus the items for the record" do
    me, alex, maya = @ids
    item = ->(n, c, m) { { name: n, cents: c, member_ids: m } }
    post "/v1/households/#{@h}/expenses", headers: auth(@t), as: :json, params: {
      amount_cents: 6380, payer_id: me, split_kind: "exact", split_weights: { me => 2127, alex => 2127, maya => 2126 },
      itemization: { tax_cents: 380, tip_cents: 0, items: [item.("Pizza", 3000, [me, alex, maya]), item.("Wings", 3000, [me, alex, maya])] }
    }
    assert_response :created
    assert_equal 2, json["data"]["itemization"]["items"].size
    assert_equal 380, json["data"]["itemization"]["tax_cents"]
  end

  test "attach a receipt photo; only images or PDFs; link is short-lived" do
    post "/v1/households/#{@h}/expenses", params: { amount_cents: 1000, payer_id: @ids[0] }, headers: auth(@t), as: :json
    id = json["data"]["id"]
    png = Rack::Test::UploadedFile.new(StringIO.new("\x89PNG\r\n\x1a\nfake".b), "image/png", true, original_filename: "r.png")
    post "/v1/expenses/#{id}/receipt", params: { file: png }, headers: auth(@t)
    assert_response :success
    assert json["data"]["has_receipt"]
    get "/v1/expenses/#{id}/receipt", headers: auth(@t)
    assert_response :redirect
    assert_match %r{/rails/active_storage/disk/}, response.location

    txt = Rack::Test::UploadedFile.new(StringIO.new("hi"), "text/plain", original_filename: "x.txt")
    post "/v1/expenses/#{id}/receipt", params: { file: txt }, headers: auth(@t)
    assert_response :unprocessable_content
  end
end
