class DeliverNotificationsJob < ApplicationJob
  queue_as :default
  def perform = Notifications::Deliver.run
end
