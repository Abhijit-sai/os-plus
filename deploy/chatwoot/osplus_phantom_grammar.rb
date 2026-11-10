require 'json'
require 'net/http'

module OsplusPhantomGrammar
  ACCOUNT_ID = 904
  MODEL = 'google/gemini-3.8-flash'.freeze
  ENDPOINT = URI('https://os-plus.vercel.app/api/chat/phantom/grammar').freeze
  KEY_PATH = '/run/secrets/osplus_phantom_grammar'.freeze
  EDITOR_ACTIONS = %w[fix_spelling_grammar improve casual professional friendly confident straightforward
                      reply_suggestion summarize follow_up].freeze

  private

  def make_api_call(messages:, feature:, **options)
    return super unless account.id == ACCOUNT_ID && feature == 'editor' && EDITOR_ACTIONS.include?(event_name.to_s)
    return editor_unavailable unless captain_tasks_enabled?

    system_message, *history, user_message = messages
    return editor_unavailable unless system_message&.fetch(:role, nil) == 'system' && user_message&.fetch(:role, nil) == 'user'
    payload = JSON.generate(system: system_message[:content], user: user_message[:content], history: history)
    return editor_unavailable if payload.bytesize > 200000

    key = File.read(KEY_PATH, 65).strip
    return editor_unavailable unless key.match?(/\A[a-f0-9]{64}\z/)

    request = Net::HTTP::Post.new(ENDPOINT, { 'Authorization' => "Bearer #{key}", 'Content-Type' => 'application/json' })
    request.body = payload
    response = Net::HTTP.start(ENDPOINT.host, ENDPOINT.port, use_ssl: true, open_timeout: 4, read_timeout: 22,
                               max_retries: 0) { |http| http.request(request) }
    return editor_unavailable unless response.is_a?(Net::HTTPOK) && response.body && response.body.bytesize <= 50000

    result = JSON.parse(response.body)
    text = result['text']
    return editor_unavailable unless result['model'] == MODEL && text.is_a?(String) && !text.strip.empty?

    answer = { message: text }
    return answer unless build_follow_up_context?

    answer.merge(follow_up_context: build_follow_up_context(messages, answer))
  rescue IOError, SystemCallError, SocketError, Timeout::Error, OpenSSL::SSL::SSLError, JSON::ParserError
    editor_unavailable
  end

  def editor_unavailable
    { error: 'AI writing assistance is temporarily unavailable.' }
  end
end

Rails.application.config.to_prepare do
  Captain::BaseTaskService.prepend(OsplusPhantomGrammar) unless Captain::BaseTaskService < OsplusPhantomGrammar
end
