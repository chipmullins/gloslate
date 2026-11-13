module V1
  # Friends: add people once (they open your link), then charge or pay them
  # in the app. Requests reach them as notifications, no texting a link.
  class FriendsController < BaseController
    TOO_MANY = -> { render json: { error: "Too many tries. Wait a minute and try again." }, status: :too_many_requests }
    rate_limit to: 20, within: 1.minute, only: %i[create preview], with: TOO_MANY, name: "friends"

    # GET /v1/friends
    def index
      friends = current_user.friends.where(deleted_at: nil).order(:first_name).to_a
      render json: { data: friends.map { |f| serialize(f) }, link: current_user.friend_url }
    end

    # GET /v1/friends/preview?token= — whose link is this?
    def preview
      u = User.find_by(friend_token: params.require(:token).to_s, deleted_at: nil)
      raise ActiveRecord::RecordNotFound unless u

      render json: { data: { first_name: u.first_name, you: u.id == current_user.id,
                             already: current_user.friendships.exists?(friend_id: u.id) } }
    end

    # POST /v1/friends { token }
    def create
      u = User.find_by(friend_token: params.require(:token).to_s, deleted_at: nil)
      raise Hometab::Error, "That friend link doesn't work anymore. Ask for a new one." unless u

      Friendship.connect!(current_user, u)
      notify_added(u)
      render json: { data: serialize(u) }, status: :created
    end

    # DELETE /v1/friends/:id — unfriend (tabs and history stay).
    def destroy
      Friendship.disconnect!(current_user, User.find(params[:id]))
      head :no_content
    end

    # POST /v1/friends/:id/tab — your one-on-one tab with them (made if needed).
    def tab
      friend = current_user.friends.find(params[:id])
      h = current_user.one_on_one_with(friend) || Households::StartWithFriend.call(user: current_user, friend:)
      render json: { data: { household_id: h.id } }, status: :created
    end

    # POST /v1/friends/link — a new link (old ones stop working).
    def reset_link
      current_user.update!(friend_token: nil)
      render json: { link: current_user.friend_url }
    end

    private

    def serialize(f)
      tab = current_user.one_on_one_with(f)
      me = tab&.members&.find_by(user: current_user)
      { user_id: f.id, first_name: f.first_name, last_initial: f.last_name.to_s[0], photo_url: f.photo_url,
        tab_id: tab&.id, net_cents: me ? tab.balance_for(me)[:net_cents] : 0 }
    end

    # They get a notification in any tab you share; otherwise nothing to attach it to.
    def notify_added(u)
      tab = current_user.one_on_one_with(u)
      member = tab&.members&.find_by(user: u)
      return unless member

      Notifications::Notify.call(member:, kind: "friend_added", title: "#{current_user.first_name} added you as a friend",
                                 body: "You can send each other requests in Gloslate now.", route: "/groups")
    end
  end
end
