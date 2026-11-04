module Hometab
  module Phone
    module_function

    # Normalizes to E.164. Assumes US (+1) when no country code is given.
    def normalize(raw)
      s = raw.to_s.strip
      digits = s.gsub(/\D/, "")
      e164 = if s.start_with?("+") then "+#{digits}"
             elsif digits.length == 10 then "+1#{digits}"
             elsif digits.length == 11 && digits.start_with?("1") then "+#{digits}"
             end
      e164 if e164&.match?(/\A\+[1-9]\d{7,14}\z/)
    end
  end
end
