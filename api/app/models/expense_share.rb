class ExpenseShare < ApplicationRecord
  belongs_to :expense
  belongs_to :member
  validates :share_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
