module Payments
  # Opens the receiver's own payment app with amount and memo filled in.
  # Tabitat never moves money; these are plain links.
  module PayLinks
    module_function

    def call(to:, amount_cents:, memo:)
      dollars = "#{amount_cents / 100}.#{(amount_cents % 100).to_s.rjust(2, '0')}"
      q = ->(h) { URI.encode_www_form(h) }
      links = {}
      if to.venmo_handle.present?
        links[:venmo] = { app: "venmo://paycharge?#{q.(txn: 'pay', recipients: to.venmo_handle, amount: dollars, note: memo)}",
                          web: "https://venmo.com/#{to.venmo_handle}?#{q.(txn: 'pay', amount: dollars, note: memo)}" }
      end
      if to.cashtag.present?
        url = "https://cash.app/#{to.cashtag}/#{dollars}"
        links[:cashapp] = { app: url, web: url }
      end
      links[:zelle] = { copy: to.zelle_contact, amount: dollars } if to.zelle_contact.present?
      { amount_cents:, dollars:, memo:, to_first_name: to.first_name, links: }
    end
  end
end
