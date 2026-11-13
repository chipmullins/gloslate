Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  # What apps poll while showing "Gloslate is paused" (open even when paused).
  get "status", to: "status#show"

  # Gloslate Control, the staff console (server-rendered, app/controllers/control).
  # Only on the staff hosts in production (CONTROL_HOSTS); "/" there opens it.
  control_host = lambda do |req|
    hosts = ENV.fetch("CONTROL_HOSTS", "").split(",").map(&:strip).reject(&:empty?)
    hosts.empty? || hosts.include?(req.host)
  end
  constraints(control_host) do
    get "/", to: redirect("/control"), constraints: ->(req) { req.host.start_with?("control.", "admin-api.") }
    scope "control", module: "control", as: "control" do
      get "/", to: "dashboard#show", as: :root
      get "sign-in", to: "sessions#new", as: :sign_in
      post "sign-in", to: "sessions#create"
      post "sign-out", to: "sessions#destroy", as: :sign_out # plain forms only send GET/POST
      get "insights", to: "insights#show", as: :insights
      resources :accounts, only: %i[index show] do
        member do
          post :revoke_sessions
          post "sessions/:session_id/revoke", action: :revoke_session, as: :revoke_session
          post :lock
          post :unlock
          post :send_code
          post :change_contact
          post "identities/:identity_id/remove", action: :remove_identity, as: :remove_identity
          post :delete, action: :destroy
          post :rename
          post :message
          post :export
        end
      end
      resources :tabs, only: %i[index show] do
        get :history, on: :member
      end
      get "server", to: "server#show", as: :server
      post "server/pause", to: "server#pause", as: :server_pause
      post "server/read-only", to: "server#read_only", as: :server_read_only
      post "server/feature", to: "server#feature", as: :server_feature
      post "server/retry-jobs", to: "server#retry_jobs", as: :server_retry_jobs
      post "server/backup", to: "server#backup", as: :server_backup
      post "server/restart", to: "server#restart", as: :server_restart
      get "audit", to: "audit#index", as: :audit
      resources :staff, only: :create do
        post :update, on: :member, as: :update
        post :reset_otp, on: :member
      end
    end
  end

  # Public pages (server-rendered)
  root "public#home"
  get "privacy", to: "public#privacy"
  get "terms", to: "public#terms"
  get "support", to: "public#support"
  get "sitemap.xml", to: "public#sitemap", defaults: { format: :xml }
  get "r/:token", to: "public#request_page", as: :public_request
  post "r/:token/paid", to: "public#mark_paid"
  get "r/:token/image.png", to: "public#request_image"
  get "i/:token", to: "public#invite"
  get "f/:token", to: "public#friend"
  get "icon.svg", to: "public#icon"
  get "favicon.ico", to: redirect("/icon.svg")
  get ".well-known/apple-app-site-association", to: "public#apple_app_site_association"
  get ".well-known/assetlinks.json", to: "public#asset_links"
  get "fonts/:name", to: "public#font", constraints: { name: /[\w-]+\.ttf/ }

  namespace :v1 do
    post "auth/codes", to: "auth#request_code"
    post "auth/codes/verify", to: "auth#verify_code"
    get "auth/providers", to: "auth#providers"
    get "reminder_tones", to: "requests#tones"
    post "auth/glofly/start", to: "auth#glofly_start"
    post "auth/glofly/finish", to: "auth#glofly_finish"
    post "auth/:provider", to: "auth#provider", constraints: { provider: /apple|google/ }

    resource :session, only: %i[update destroy]
    resource :me, controller: "me", only: %i[show update destroy] do
      get :export
      post :photo, action: :upload_photo
      delete :photo, action: :remove_photo
    end
    post "identities/glofly/start", to: "identities#glofly_start"
    resources :identities, only: %i[create destroy]
    resources :friends, only: %i[index create destroy] do
      collection do
        get :preview
        post :link, action: :reset_link
      end
      post :tab, on: :member
    end

    resources :notifications, only: :index do
      post :read, on: :collection
      post :test, on: :collection
    end
    get "pulse", to: "pulse#show"
    get "recap", to: "recap#show"
    get "recap/image.png", to: "recap#image", as: :recap_image
    resources :people, only: %i[index show] do
      member do
        post :settle
        post :request, action: :request_net
      end
    end

    resources :households, only: %i[index show create update] do
      member do
        post :hide
        delete :hide, action: :unhide
      end
      resources :members, only: %i[create update destroy]
      resources :invites, only: :create
      resources :expenses, only: %i[index create] do
        post :preview, on: :collection
        post :counter, on: :collection
      end
      resources :bills, only: %i[index create] do
        get :presets, on: :collection
      end
      resources :payments, only: %i[index create]
      resources :requests, only: :create
      resources :statements, only: :index
      get :history, to: "statements#history"
      get "export", to: "statements#export", defaults: { format: :csv }
      get "balances/:member_id", to: "payments#breakdown"
      get "pay/:member_id", to: "payments#pay_info"
    end
    resources :statements, only: :show
    resources :payments, only: :show do
      member do
        post :confirm
        post :dispute
        post :note
      end
    end
    resources :bills, only: %i[update destroy]
    resources :bill_cycles, only: %i[show update] do
      member do
        post :amount
        post :skip
      end
    end
    resources :expenses, only: %i[show update destroy] do
      member do
        post :restore
        post :flag
        get :receipt
        post :receipt, action: :upload_receipt
      end
    end
    get "invites/:token", to: "invites#show"
    post "invites/:token/accept", to: "invites#accept"
  end

  namespace :admin do
    namespace :v1 do
      resource :session, only: %i[create show destroy]
      resource :dashboard, controller: "dashboard", only: :show
      get "server", to: "server#show"
      get "server/uptime", to: "server#uptime"
      get "insights", to: "server#insights"
      post "server/pause", to: "server#pause"
      post "server/read_only", to: "server#read_only"
      post "server/feature", to: "server#feature"
      resources :users, only: %i[index show] do
        member do
          post :revoke_sessions
          post :lock
          post :unlock
          post :send_sign_in_code
          post :export
          post :delete_account, action: :destroy_account
          post :identities, action: :add_identity
          delete "identities/:identity_id", action: :remove_identity
        end
      end
      resources :households, only: :show do
        get :ledger, on: :member
      end
      resources :audit_events, only: :index
      resources :staff, only: %i[index create update] do
        post :reset_otp, on: :member
      end
    end
  end
end
