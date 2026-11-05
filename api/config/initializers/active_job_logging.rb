# Mail jobs carry sign-in codes in their arguments; keep them out of logs.
Rails.application.config.after_initialize do
  ActionMailer::MailDeliveryJob.log_arguments = false
end
