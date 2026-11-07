module Control
  # Find people and help them. Gloslate accounts have no passwords (codes,
  # Apple, Google): "reset" means change their email/phone, send a code, or
  # sign them out. Staff never touch money.
  class AccountsController < BaseController
    before_action :load_user, except: :index
    before_action -> { require_role!(:support) }, except: %i[index show]

    FILTERS = {
      "all" => "All", "new" => "New this week", "active" => "Active today", "locked" => "Locked",
      "quiet" => "No visit in 30 days", "deleted" => "Deleted"
    }.freeze

    def index
      @filter = FILTERS.key?(params[:filter]) ? params[:filter] : "all"
      scope = case @filter
              when "new" then User.active.where(created_at: 7.days.ago..)
              when "active" then User.active.where(id: ActiveDay.where(day: ActiveDay.today).select(:user_id))
              when "locked" then User.active.where.not(locked_at: nil)
              when "quiet" then User.active.where("last_active_at IS NULL OR last_active_at < ?", 30.days.ago)
              when "deleted" then User.where.not(deleted_at: nil)
              else User.active
              end
      if (q = params[:q].to_s.strip).present?
        phone = Hometab::Phone.normalize(q)
        like = "%#{User.sanitize_sql_like(q)}%"
        scope = scope.left_joins(:identities).where(
          "users.email ILIKE :like OR users.first_name ILIKE :like OR users.last_name ILIKE :like OR concat(users.first_name, ' ', users.last_name) ILIKE :like " \
          "OR users.id::text = :q OR users.phone = :phone OR identities.provider_uid = :phone OR identities.email ILIKE :like", like:, q:, phone:
        ).distinct
        audit!("users.search")
      end
      @page = [params[:page].to_i, 1].max
      @total = scope.count
      @users = scope.order(created_at: :desc).offset((@page - 1) * 40).limit(40).to_a
    end

    def show
      audit!("users.show", target: @user)
      @identities = @user.identities.order(:created_at)
      @sessions = @user.sessions.order(Arel.sql("revoked_at IS NULL DESC, last_seen_at DESC NULLS LAST")).limit(20)
      @members = @user.members.includes(:household).order(:created_at)
      @friends = @user.friends.where(deleted_at: nil).order(:first_name)
      @active_days = ActiveDay.where(user_id: @user.id, day: (ActiveDay.today - 29)..).count
      @activity = AnalyticsEvent.where(user_id: @user.id).order(created_at: :desc).limit(12)
      @staff_history = AdminAuditEvent.where(target_id: @user.id).where.not(action: "users.show").order(created_at: :desc).limit(10)
      @overall = @members.reject { _1.household.nil? }.sum { |m| m.left_at ? 0 : m.household.balance_for(m)[:net_cents] }
    end

    def revoke_sessions
      reason = require_reason!
      n = @user.revoke_sessions!("staff:#{current_staff.id}")
      audit!("users.revoke_sessions", target: @user, reason:)
      done("Signed #{@user.first_name} out of #{n} #{n == 1 ? 'device' : 'devices'}.")
    end

    def revoke_session
      reason = require_reason!
      s = @user.sessions.find(params[:session_id])
      s.update!(revoked_at: Time.current, revoked_reason: "staff:#{current_staff.id}")
      audit!("users.revoke_session", target: @user, reason:)
      done("Signed out #{s.device_name.presence || 'that device'}.")
    end

    def lock
      reason = require_reason!
      @user.update!(locked_at: Time.current, locked_reason: reason)
      @user.revoke_sessions!("locked")
      audit!("users.lock", target: @user, reason:)
      done("Locked. #{@user.first_name} is signed out and can't sign in.")
    end

    def unlock
      reason = require_reason!
      @user.update!(locked_at: nil, locked_reason: nil)
      audit!("users.unlock", target: @user, reason:)
      done("Unlocked.")
    end

    def send_code
      reason = require_reason!
      identity = @user.identities.where(provider: %w[email phone]).find(params.require(:identity_id))
      Auth::RequestCode.call(destination: identity.provider_uid, ip: request.remote_ip)
      audit!("users.send_sign_in_code", target: @user, reason:)
      done("Sent a sign-in code to #{mask(identity.provider == 'phone' ? identity.provider_uid : identity.email)}.")
    end

    # Change email or phone: adds the new one (they sign in with a code sent
    # there) and, unless unticked, removes the old one of the same kind.
    def change_contact
      reason = require_reason!
      channel, normalized = Auth::Destination.parse(params.require(:destination))
      User.transaction do
        Auth::LinkIdentity.attach!(@user, channel, normalized, email: (normalized if channel == "email"), email_verified: false)
        if params[:replace] == "1"
          @user.identities.where(provider: channel).where.not(provider_uid: normalized).find_each(&:destroy!)
        end
        @user.update!(channel == "email" ? { email: normalized } : { phone: normalized })
      end
      audit!("users.change_#{channel}", target: @user, reason:)
      done("#{channel == 'email' ? 'Email' : 'Phone'} changed. They can sign in with a code sent there.")
    end

    def remove_identity
      reason = require_reason!
      identity = @user.identities.find(params[:identity_id])
      Auth::LinkIdentity.unlink!(user: @user, identity:)
      audit!("users.remove_identity", target: @user, reason:)
      done("Removed that sign-in method.")
    end

    def rename
      reason = require_reason!
      @user.update!(first_name: params.require(:first_name).strip, last_name: params[:last_name].to_s.strip.presence)
      audit!("users.rename", target: @user, reason:)
      done("Name saved.")
    end

    # A message from the team: shows in their notifications (and as a push).
    def message
      reason = require_reason!
      body = params.require(:body).to_s.strip
      raise Hometab::Error, "Write a message" if body.length < 3

      Notification.create!(user: @user, kind: "team_message", title: "From the Gloslate team", body: body[0, 500],
                           data: { route: "/notifications" }, deliver_after: Time.current)
      audit!("users.message", target: @user, reason:)
      done("Sent. It shows in their notifications.")
    end

    def export
      reason = require_reason!
      audit!("users.export", target: @user, reason:)
      send_data JSON.pretty_generate(Accounts::Export.call(@user)), filename: "gloslate-#{@user.id}-#{Date.current}.json", type: "application/json"
    end

    # Admins only, and they type the person's first name to confirm.
    def destroy
      require_role!(:admin)
      reason = require_reason!
      raise Hometab::Error, "Type their first name to confirm" unless params[:confirm].to_s.strip.casecmp?(@user.first_name.to_s.strip)
      raise Hometab::Error, "Already deleted" if @user.deleted?

      Accounts::Delete.call(@user, reason: "staff:#{reason}")
      audit!("users.delete_account", target: @user, reason:)
      done("Account deleted. Their tabs keep the history as “Former member”.", to: control_accounts_path)
    end

    private

    def load_user = @user = User.find(params[:id])
  end
end
