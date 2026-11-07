class Friendship < ApplicationRecord
  belongs_to :user
  belongs_to :friend, class_name: "User"

  # Both sides at once; already friends is fine.
  def self.connect!(a, b)
    raise Hometab::Error, "That's your own link" if a.id == b.id
    raise Hometab::Error, "That account was deleted" if a.deleted? || b.deleted?

    transaction do
      [[a, b], [b, a]].each { |x, y| find_or_create_by!(user: x, friend: y) }
    end
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  def self.disconnect!(a, b)
    where(user: a, friend: b).or(where(user: b, friend: a)).delete_all
  end
end
