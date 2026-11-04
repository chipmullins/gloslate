module Hometab
  module Money
    module_function

    # 86460 → "$864.60" (integer math only)
    def format(cents)
      sign = cents.negative? ? "−" : ""
      c = cents.abs
      "#{sign}$#{(c / 100).to_s.reverse.scan(/\d{1,3}/).join(',').reverse}.#{(c % 100).to_s.rjust(2, '0')}"
    end
  end
end
