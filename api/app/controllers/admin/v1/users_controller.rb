module Admin
  module V1
    # Look up and help HomeTab users. Users have no passwords (codes, Apple,
    # Google), so "reset" means: attach a new email/phone, sign out devices,
    # send a fresh code, or lock/unlock.
    class UsersController < BaseController
      before_action :load_user, except: :index
      before_action -> { require_role!(:support) }, except: %i[index show]

      def index
        scope = User.order(created_at: :desc)
        if (q = params[:q].to_s.strip).present?
          phone = Hometab::Phone.normalize(q)
          scope = scope.where("users.email ILIKE :q OR users.first_name ILIKE :q OR users.last_name ILIKE :q OR users.id::text = :exact OR users.phone = :phone",
                              q: "%#{User.sanitize_sql_like(q)}%", exact: q, phone:)
        end
        rows, meta = page_meta(scope)
        audit!("users.search")
        render json: { data: rows.map { |u| summary(u) }, meta: }
      end

      def show
        audit!("users.show", target: @user)
        render json: { data: summary(@user).merge(
          identities: @user.identities.map { |i| { id: i.id, provider: i.provider, email: mask(i.email), last_used_at: i.last_used_at } },
          sessions: @user.sessions.order(created_at: :desc).limit(20).map { |s|
            { id: s.id, device_name: s.device_name, platform: s.platform, app_version: s.app_version,
              last_seen_at: s.last_seen_at, revoked_at: s.revoked_at }
          },
          households: @user.members.includes(:household).map { |m|
            { household_id: m.household_id, name: m.household.name, member_id: m.id, left_at: m.left_at }
          }
        ) }
      end

      def revoke_sessions
        reason = require_reason!
        n = @user.revoke_sessions!("staff:#{current_staff.id}")
        audit!("users.revoke_sessions", target: @user, reason:)
        render json: { revoked: n }
      end

      def lock
        reason = require_reason!
        @user.update!(locked_at: Time.current, locked_reason: reason)
        @user.revoke_sessions!("locked")
        audit!("users.lock", target: @user, reason:)
        render json: { data: summary(@user) }
      end

      def unlock
        reason = require_reason!
        @user.update!(locked_at: nil, locked_reason: nil)
        audit!("users.unlock", target: @user, reason:)
        render json: { data: summary(@user) }
      end

      # Sends a fresh sign-in code to an email/phone already on the account.
      def send_sign_in_code
        reason = require_reason!
        dest = params.require(:destination)
        _, normalized = Auth::Destination.parse(dest)
        unless @user.identities.where(provider: %w[email phone], provider_uid: normalized).exists?
          raise Hometab::Error, "That email or phone isn't on this account"
        end
        Auth::RequestCode.call(destination: normalized, ip: request.remote_ip)
        audit!("users.send_sign_in_code", target: @user, reason:)
        render json: { sent: true }, status: :accepted
      end

      # Locked out (lost phone / old email): attach a new email or phone the
      # person proved to support by other means. They then sign in with a code.
      def add_identity
        reason = require_reason!
        channel, normalized = Auth::Destination.parse(params.require(:destination))
        identity = Auth::LinkIdentity.attach!(@user, channel, normalized, email: (normalized if channel == "email"),
                                                                          email_verified: false)
        audit!("users.add_identity", target: @user, reason:)
        render json: { id: identity.id, provider: identity.provider }, status: :created
      end

      # Same deletion as the user's own (support request); admin only.
      def destroy_account
        require_role!(:admin)
        reason = require_reason!
        Accounts::Delete.call(@user, reason: "staff:#{reason}")
        audit!("users.delete_account", target: @user, reason:)
        head :no_content
      end

      def export
        audit!("users.export", target: @user, reason: require_reason!)
        render json: Accounts::Export.call(@user)
      end

      def remove_identity
        reason = require_reason!
        identity = @user.identities.find(params[:identity_id])
        Auth::LinkIdentity.unlink!(user: @user, identity:)
        audit!("users.remove_identity", target: @user, reason:)
        head :no_content
      end

      private

      def load_user = @user = User.find(params[:id])

      def summary(u)
        { id: u.id, first_name: u.first_name, last_name: u.last_name, email: mask(u.email), phone: mask(u.phone),
          created_at: u.created_at, last_active_at: u.last_active_at, locked: u.locked?, locked_reason: u.locked_reason,
          deleted: u.deleted? }
      end
    end
  end
end
