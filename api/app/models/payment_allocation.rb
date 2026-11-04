class PaymentAllocation < ApplicationRecord
  belongs_to :payment
  belongs_to :expense
  validates :cents, numericality: { only_integer: true, greater_than: 0 }
end
