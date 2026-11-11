require "test_helper"

# Gentle · Plain · Cheeky: set once in Reminders, changeable per request,
# and the request keeps the voice it was sent with.
class ReminderToneTest < ActionDispatch::IntegrationTest
  setup do
    @chip = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Maya"] }, headers: auth(@chip), as: :json
    @h = json["data"]["id"]
    @chip_id = json["data"]["me"]["id"]
    @maya_id = json["data"]["members"].find { !_1["you"] }["id"]
    post "/v1/households/#{@h}/expenses", params: { amount_cents: 4900, payer_id: @chip_id, description: "Dinner" }, headers: auth(@chip), as: :json
  end

  def request!(**extra)
    post "/v1/households/#{@h}/requests", params: { member_id: @maya_id, **extra }, headers: auth(@chip), as: :json
    assert_response :created
    json["data"]
  end

  test "plain is the default and reads exactly as before" do
    data = request!
    assert_equal "plain", data["tone"]
    assert_equal "Hey Maya! Here's where we're at: $24.50. Breakdown and pay buttons: #{data['url']}", data["message"]
    get "/r/#{data['token']}"
    assert_includes response.body, "Chip is requesting"
  end

  test "your Reminders tone is saved everywhere and used for new requests" do
    patch "/v1/me", params: { member: { reminder_tone: "gentle" } }, headers: auth(@chip), as: :json
    assert_response :ok
    assert_equal "gentle", Member.find(@chip_id).reminder_tone
    data = request!
    assert_equal "gentle", data["tone"]
    assert_match(/No rush/, data["message"])
    get "/r/#{data['token']}"
    assert_includes response.body, "Chip sent you a request"
  end

  test "one request can use another tone, and keeps it" do
    data = request!(tone: "cheeky")
    assert_equal "cheeky", PaymentRequest.last.tone
    patch "/v1/me", params: { member: { reminder_tone: "gentle" } }, headers: auth(@chip), as: :json
    get "/r/#{data['token']}"
    assert_includes response.body, "Chip&#39;s slate says"
  end

  test "unknown tones are refused" do
    post "/v1/households/#{@h}/requests", params: { member_id: @maya_id, tone: "angry" }, headers: auth(@chip), as: :json
    assert_response :unprocessable_content
    patch "/v1/me", params: { member: { reminder_tone: "angry" } }, headers: auth(@chip), as: :json
    assert_response :unprocessable_content
  end

  test "the picker catalog has all three with examples in your name" do
    get "/v1/reminder_tones", headers: auth(@chip)
    assert_equal %w[gentle plain cheeky], json["data"].map { _1["key"] }
    assert_equal "plain", json["default"]
    json["data"].each do |t|
      %w[request reminder].each { |k| assert_includes t["examples"][k].values.join(" "), "Chip" }
      assert_includes t["examples"]["share"], "Jordan"
    end
  end

  test "every variant stays kind and never claims Gloslate checks or moves money" do
    banned = /\b(debts?|overdue|late|verified|we sent|transferred|deadbeat|pay up)\b/i
    Requests::Tone::KEYS.each do |k|
      strings = [Requests::Tone.request_push(k, from: "Chip", amount: "$5.00").values,
                 Requests::Tone.reminder_push(k, to: "Chip", amount: "$5.00").values,
                 Requests::Tone.share_text(k, to: "Maya", amount: "$5.00", url: "u"),
                 Requests::Tone.page_headline(k, from: "Chip"), Requests::Tone.page_description(k)].flatten
      strings.each { |s| refute_match banned, s, "#{k}: #{s}" }
    end
  end
end
