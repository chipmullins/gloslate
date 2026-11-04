module Hometab
  module Money
    module_function

    # 86460 → "$864.60" (integer math only)
    def format(cents)
      sign = cents.negative? ? "−" : ""
      c = cents.abs
      "#{sign}$#{(c / 100).to_s.reverse.scan(/\d{1,3}/).join(',').reverse}.#{(c % 100).to_s.rjust(2, '0')}"
    end

    # "$864.60" / "864.6" / "1,200" → cents, no float math. nil if unreadable.
    def parse(str)
      m = str.to_s.delete("$, ").match(/\A(\d{1,7})(?:\.(\d{1,2}))?\z/)
      return nil unless m

      (m[1].to_i * 100) + m[2].to_s.ljust(2, "0").to_i
    end
  end
end
