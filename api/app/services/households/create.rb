module Households
  # First run: "Who do you live with?" creates the home, your member, and a
  # placeholder for each roommate. Target: under 60 seconds to a working home.
  class Create
    def self.call(...) = new(...).call

    def initialize(user:, name: nil, display_name: nil, roommates: [], handles: {})
      @user = user
      @roommates = Array(roommates).map { _1.to_s.strip }.reject(&:empty?)
      @display_name = display_name.presence || user.first_name.presence || "Me"
      @name = name.presence || default_name
      @handles = handles.to_h.symbolize_keys.slice(:venmo_handle, :cashtag, :zelle_contact)
    end

    def call
      raise Hometab::Error, "A home can have up to #{Household::MAX_MEMBERS} people" if @roommates.size + 1 > Household::MAX_MEMBERS

      household = Household.transaction do
        h = Household.create!(name: @name)
        me = h.members.create!(user: @user, display_name: @display_name, **@handles)
        @roommates.each { |n| h.members.create!(display_name: n) }
        LedgerEvent.record!(household: h, kind: "household.created", subject: h, actor: me,
                            data: { name: @name, roommates: @roommates })
        h
      end
      AnalyticsEvent.track("household_created", user: @user, household:, size: @roommates.size + 1)
      household
    end

    private

    def default_name
      @roommates.size == 1 ? "#{@display_name.split.first} & #{@roommates.first.split.first}" : "#{@display_name.split.first}'s home"
    end
  end
end
