namespace :staff do
  desc "Create the first admin: bin/rails staff:create EMAIL=you@x.com NAME='Chip' (prompts for password)"
  task create: :environment do
    require "io/console"
    email = ENV.fetch("EMAIL") { abort "EMAIL=... required" }
    print "Password (12+ chars): "
    password = ENV["PASSWORD"] || $stdin.noecho(&:gets).to_s.chomp
    puts
    staff = StaffUser.create!(email:, name: ENV.fetch("NAME", email), role: ENV.fetch("ROLE", "admin"), password:)
    puts "Created #{staff.role} #{staff.email}."
    puts "Add this to your authenticator app now (it isn't shown again):"
    puts staff.otp_uri
  end
end
