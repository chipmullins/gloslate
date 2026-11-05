class Member < ApplicationRecord
  belongs_to :household
  belongs_to :user, optional: true

  before_validation :normalize_handles
  validates :venmo_handle, format: { with: /\A[A-Za-z0-9_-]{5,30}\z/, message: "doesn't look like a Venmo username" }, allow_blank: true
  validates :cashtag, format: { with: /\A\$[A-Za-z][A-Za-z0-9]{0,19}\z/, message: "doesn't look like a $cashtag" }, allow_blank: true
  validate :zelle_contact_format

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

  def handles = { venmo: venmo_handle, cashapp: cashtag, zelle: zelle_contact }.compact_blank

  def as_api_json(viewer: nil)
    base = { id:, display_name:, first_name:, placeholder: placeholder?, former: former?, you: viewer&.id == id,
             moved_in_on:, moved_out_on:, handles: }
    viewer&.id == id ? base.merge(auto_remind:, remind_threshold_cents:, remind_after_days:) : base
  end

  private

  def normalize_handles
    self.venmo_handle = venmo_handle.to_s.strip.delete_prefix("@").presence
    if (c = cashtag.to_s.strip.presence)
      self.cashtag = c.start_with?("$") ? c : "$#{c}"
    else
      self.cashtag = nil
    end
    z = zelle_contact.to_s.strip
    self.zelle_contact = z.include?("@") ? z.downcase : (Hometab::Phone.normalize(z) || z.presence)
  end

  def zelle_contact_format
    return if zelle_contact.blank?
    return if zelle_contact.match?(Auth::Destination::EMAIL) || zelle_contact.match?(/\A\+\d{8,15}\z/)

    errors.add(:zelle_contact, "should be the email or phone your bank uses for Zelle")
  end

  def household_not_full
    return unless household
    return if household.members.current.count < Household::MAX_MEMBERS

    errors.add(:base, "A home can have up to #{Household::MAX_MEMBERS} people")
  end
end
