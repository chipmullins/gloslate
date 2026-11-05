# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  # Tabitat: sign-in codes, phone numbers, payment handles, ID/link tokens
  :code, :phone, :destination, :id_token, :link_token, :push_token, :zelle_contact, :venmo_handle, :cashtag
]
