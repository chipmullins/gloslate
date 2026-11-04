class Identity < ApplicationRecord
  PROVIDERS = %w[email phone apple google glofly].freeze

  belongs_to :user
  validates :provider, inclusion: { in: PROVIDERS }
  validates :provider_uid, presence: true, uniqueness: { scope: :provider }
end
