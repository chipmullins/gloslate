class Member < ApplicationRecord
  belongs_to :household

  validates :display_name, presence: true, length: { maximum: 40 }
  validate :household_not_full, on: :create

  scope :current, -> { where(left_at: nil) }

  def placeholder? = user_id.nil?
  def former? = left_at.present?
  def first_name = display_name.split.first

  # Move-in / move-out: never part of costs outside these dates.
  def active_on?(date)
    (moved_in_on.nil? || date >= moved_in_on) && (moved_out_on.nil? || date <= moved_out_on)
  end

  private

  def household_not_full
    return unless household
    return if household.members.current.count < Household::MAX_MEMBERS

    errors.add(:base, "A home can have up to #{Household::MAX_MEMBERS} people")
  end
end
