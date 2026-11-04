class AdminAuditEvent < ApplicationRecord
  REDACT = %w[password code otp token id_token link_token].freeze

  before_update { raise ActiveRecord::ReadOnlyRecord }
  before_destroy { raise ActiveRecord::ReadOnlyRecord }

  def self.redact(params)
    params.to_h.except("controller", "action", "format").to_h { |k, v| [k, REDACT.include?(k.to_s) ? "[redacted]" : v] }
  end
end
