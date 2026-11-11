module Requests
  # How Gloslate asks on someone's behalf: Gentle · Plain · Cheeky. Every
  # string sent or shown in the requester's voice lives here, so the push,
  # the share text, the request page and the app's preview never drift apart.
  #
  # House rules for every variant: kind, never shaming, no "debt" or
  # "overdue" language, and Gloslate never claims to check or move money
  # (CLAUDE.md rule 5). "Owe" is fine; it's what the balance screens say.
  module Tone
    KEYS = %w[gentle plain cheeky].freeze
    DEFAULT = "plain".freeze

    LABELS = {
      "gentle" => { label: "Gentle", blurb: "Soft and no-rush" },
      "plain" => { label: "Plain", blurb: "Just the facts" },
      "cheeky" => { label: "Cheeky", blurb: "A little playful" }
    }.freeze

    module_function

    def normalize(tone) = KEYS.include?(tone.to_s) ? tone.to_s : DEFAULT

    def validate!(tone)
      raise Hometab::Error, "Pick Gentle, Plain or Cheeky" unless tone.nil? || KEYS.include?(tone.to_s)
    end

    # Push to the person asked, when the request is sent.
    def request_push(tone, from:, amount:)
      case normalize(tone)
      when "gentle" then { title: "#{from} sent you a request for #{amount}", body: "No rush. The breakdown and pay buttons are here when you're ready." }
      when "cheeky" then { title: "Psst: #{amount} for #{from}", body: "Breakdown and pay buttons inside. One tap to a clean slate." }
      else { title: "#{from} is requesting #{amount}", body: "Tap to see the breakdown and pay." }
      end
    end

    # Push from the automatic reminders (sent for the person who's owed).
    def reminder_push(tone, to:, amount:)
      case normalize(tone)
      when "gentle" then { title: "A friendly reminder", body: "Whenever it suits you: #{amount} for #{to}. No rush." }
      when "cheeky" then { title: "The bunny hopped by", body: "#{amount} for #{to} is still on the slate. Wipe it clean whenever you like." }
      else { title: "Quick nudge from Gloslate", body: "You owe #{to} #{amount}. Settle up anytime." }
      end
    end

    # The text that goes with the link when it's shared or texted.
    def share_text(tone, to:, amount:, url:)
      case normalize(tone)
      when "gentle" then "Hi #{to}! No rush at all, here's where we're at: #{amount}. Breakdown and pay buttons: #{url}"
      when "cheeky" then "#{to}! Our slate says #{amount}. Breakdown and pay buttons, no math required: #{url}"
      else "Hey #{to}! Here's where we're at: #{amount}. Breakdown and pay buttons: #{url}"
      end
    end

    # Headline on the request page and its share image: "<headline> $24.50".
    def page_headline(tone, from:)
      case normalize(tone)
      when "gentle" then "#{from} sent you a request"
      when "cheeky" then "#{from}'s slate says"
      else "#{from} is requesting"
      end
    end

    def page_description(tone)
      case normalize(tone)
      when "gentle" then "No rush. See the breakdown & pay when you're ready. Gloslate never holds your money."
      when "cheeky" then "One tap to a clean slate. Gloslate never holds your money."
      else "Tap to see the breakdown & pay. Gloslate never holds your money."
      end
    end

    # For the app's picker: what each tone sounds like, with sample names.
    def catalog(me: "Chip", them: "Jordan", amount: "$24.50")
      KEYS.map do |k|
        { key: k, **LABELS[k],
          examples: { request: request_push(k, from: me, amount:), reminder: reminder_push(k, to: me, amount:),
                      share: share_text(k, to: them, amount:, url: "gloslate.app/r/…") } }
      end
    end
  end
end
