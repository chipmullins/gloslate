# Email through Amazon SES using the server's role (lib/hometab/aws_api.rb).
ActiveSupport.on_load(:action_mailer) { add_delivery_method :ses, Hometab::SesDelivery }
