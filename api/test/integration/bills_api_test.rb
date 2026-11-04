require "test_helper"

class BillsApiTest < ActionDispatch::IntegrationTest
  setup do
    @t = sign_in_by_phone["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex"] }, headers: auth(@t), as: :json
    @h = json["data"]["id"]
  end

  test "first-run presets and coming up" do
    post "/v1/households/#{@h}/bills", params: { preset: "rent", amount_cents: 180000 }, headers: auth(@t), as: :json
    assert_response :created
    post "/v1/households/#{@h}/bills", params: { preset: "electric" }, headers: auth(@t), as: :json
    get "/v1/households/#{@h}/bills", headers: auth(@t)
    assert_equal %w[Rent Electric], json["data"].map { _1["name"] }
    assert json["coming_up"].any? { _1["name"] == "Electric" && _1["kind"] == "variable" }
  end

  test "enter a variable amount, change and skip a cycle" do
    post "/v1/households/#{@h}/bills", params: { name: "Water", kind: "variable", due_day: 1 }, headers: auth(@t), as: :json
    get "/v1/households/#{@h}/bills", headers: auth(@t)
    cycle = json["coming_up"].first["id"]
    post "/v1/bill_cycles/#{cycle}/amount", params: { amount_cents: 4000 }, headers: auth(@t), as: :json
    assert_response :success
    assert_equal "posted", json["data"]["status"]
    post "/v1/bill_cycles/#{cycle}/skip", headers: auth(@t)
    assert_response :unprocessable_content
  end

  test "fixed bill needs an amount" do
    post "/v1/households/#{@h}/bills", params: { name: "Rent", kind: "fixed", due_day: 1 }, headers: auth(@t), as: :json
    assert_response :unprocessable_content
  end
end
