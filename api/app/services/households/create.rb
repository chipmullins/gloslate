module Households
  # First run: "Who do you live with?" creates the home, your member, and a
  # placeholder for each roommate. Target: under 60 seconds to a working home.
  class Create
    def self.call(...) = new(...).call

    def initialize(user:, name: nil, display_name: nil, roommates: [], handles: {}, kind: "home")
      @user = user
      @kind = kind.to_s.presence || "home"
      raise Hometab::Error, "Pick home or group" unless Household::KINDS.include?(@kind)
      raise Hometab::Error, "Name your group" if @kind == "group" && name.to_s.strip.empty?
      @roommates = Array(roommates).map { _1.to_s.strip }.reject(&:empty?)
      @display_name = display_name.presence || user.first_name.presence || "Me"
      @name = name.presence || default_name
      @handles = handles.to_h.symbolize_keys.slice(:venmo_handle, :cashtag, :zelle_contact)
    end

    def call
      max = @kind == "group" ? Household::MAX_GROUP_MEMBERS : Household::MAX_MEMBERS
      raise Hometab::Error, "A #{@kind} can have up to #{max} people" if @roommates.size + 1 > max

      household = Household.transaction do
        # Groups settle the quickest way from the start: fewest payments.
        h = Household.create!(name: @name, kind: @kind, simplify_debts: @kind == "group")
        me = h.members.create!(user: @user, display_name: @display_name, **@user.payment_handles, **@handles.compact_blank)
        @roommates.each { |n| h.members.create!(display_name: n) }
        LedgerEvent.record!(household: h, kind: "household.created", subject: h, actor: me,
                            data: { name: @name, kind: @kind, roommates: @roommates })
        h
      end
      AnalyticsEvent.track(@kind == "group" ? "group_created" : "household_created", user: @user, household:, size: @roommates.size + 1)
      household
    end

    private

    def default_name
      @roommates.size == 1 ? "#{@display_name.split.first} & #{@roommates.first.split.first}" : "#{@display_name.split.first}'s home"
    end
  end
end
