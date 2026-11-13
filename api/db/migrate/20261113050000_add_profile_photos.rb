# Profile photos live in Active Storage (users.photo). Glofly's photo link is kept on
# the Glofly sign-in method only so the person can choose "Use my Glofly photo".
class AddProfilePhotos < ActiveRecord::Migration[8.0]
  def change
    add_column :identities, :picture_url, :string
  end
end
