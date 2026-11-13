require "test_helper"

class ProfilePhotoTest < ActionDispatch::IntegrationTest
  setup do
    @t = sign_in_by_phone["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex"] }, headers: auth(@t), as: :json
    @h = json["data"]["id"]
  end

  def png = Rack::Test::UploadedFile.new(StringIO.new("\x89PNG\r\n\x1a\nfake".b), "image/png", true, original_filename: "me.png")

  test "upload a photo, it shows on me and on my member; remove it" do
    get "/v1/me", headers: auth(@t)
    assert_nil json["photo_url"]
    assert_equal false, json["glofly_photo"]

    post "/v1/me/photo", params: { file: png }, headers: auth(@t)
    assert_response :success
    assert json["photo_url"].present?

    get "/v1/households/#{@h}", headers: auth(@t)
    me = json["data"]["members"].find { _1["you"] }
    assert me["photo_url"].present?

    delete "/v1/me/photo", headers: auth(@t)
    assert_response :success
    assert_nil json["photo_url"]
  end

  test "only images, and Glofly photo needs a Glofly sign-in" do
    txt = Rack::Test::UploadedFile.new(StringIO.new("hi"), "text/plain", original_filename: "x.txt")
    post "/v1/me/photo", params: { file: txt }, headers: auth(@t)
    assert_response :unprocessable_content

    post "/v1/me/photo", params: { from: "glofly" }, headers: auth(@t), as: :json
    assert_response :unprocessable_content
    assert_match(/Glofly/, json["error"])
  end
end
