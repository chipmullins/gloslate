Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :v1 do
    post "auth/codes", to: "auth#request_code"
    post "auth/codes/verify", to: "auth#verify_code"
    post "auth/:provider", to: "auth#provider", constraints: { provider: /apple|google/ }

    resource :session, only: %i[update destroy]
    resource :me, controller: "me", only: %i[show update]
    resources :identities, only: %i[create destroy]
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
