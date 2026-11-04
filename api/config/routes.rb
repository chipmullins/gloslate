Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # Public pages (server-rendered)
  root "public#home"
  get "r/:token", to: "public#request_page", as: :public_request
  post "r/:token/paid", to: "public#mark_paid"
  get "r/:token/image.png", to: "public#request_image"
  get "i/:token", to: "public#invite"
  get "icon.svg", to: "public#icon"
  get "fonts/:name", to: "public#font", constraints: { name: /[\w-]+\.ttf/ }

  namespace :v1 do
    post "auth/codes", to: "auth#request_code"
    post "auth/codes/verify", to: "auth#verify_code"
    post "auth/:provider", to: "auth#provider", constraints: { provider: /apple|google/ }

    resource :session, only: %i[update destroy]
    resource :me, controller: "me", only: %i[show update]
    resources :identities, only: %i[create destroy]

    resources :households, only: %i[index show create update] do
      resources :members, only: %i[create update destroy]
      resources :invites, only: :create
      resources :expenses, only: %i[index create] do
        post :preview, on: :collection
      end
      resources :bills, only: %i[index create] do
        get :presets, on: :collection
      end
      resources :payments, only: %i[index create]
      resources :requests, only: :create
      get "balances/:member_id", to: "payments#breakdown"
      get "pay/:member_id", to: "payments#pay_info"
    end
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
      end
    end
    get "invites/:token", to: "invites#show"
    post "invites/:token/accept", to: "invites#accept"
  end

  namespace :admin do
    namespace :v1 do
      resource :session, only: %i[create show destroy]
      resource :dashboard, controller: "dashboard", only: :show
      resources :users, only: %i[index show] do
        member do
          post :revoke_sessions
          post :lock
          post :unlock
          post :send_sign_in_code
          post :identities, action: :add_identity
          delete "identities/:identity_id", action: :remove_identity
        end
      end
      resources :households, only: :show do
        get :ledger, on: :member
      end
      resources :audit_events, only: :index
      resources :staff, only: %i[index create update]
    end
  end
end
