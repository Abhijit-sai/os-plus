require 'json'
require 'net/http'

module OsplusPhantomGrammar
  ACCOUNT_ID = 904
  MODEL = 'google/gemini-3.8-flash'.freeze
  ENDPOINT = URI('https://os-plus.vercel.app/api/chat/phantom/grammar').freeze
  KEY_PATH = '/run/secrets/osplus_phantom_grammar'.freeze

  private

  def make_api_call(messages:, feature:, **options)
    return super unless account.id == ACCOUNT_ID && operation.to_s == 'fix_spelling_grammar' && feature == 'editor'
    return grammar_unavailable unless captain_tasks_enabled?

    draft = messages.last&.fetch(:content, nil)
    return grammar_unavailable unless draft.is_a?(String) && draft.length.between?(1, 6000) && !draft.strip.empty?

    key = File.read(KEY_PATH, 65).strip
    return grammar_unavailable unless key.match?(/\A[a-f0-9]{64}\z/)

    request = Net::HTTP::Post.new(ENDPOINT, { 'Authorization' => "Bearer #{key}", 'Content-Type' => 'application/json' })
    request.body = JSON.generate(draft: draft)
    response = Net::HTTP.start(ENDPOINT.host, ENDPOINT.port, use_ssl: true, open_timeout: 4, read_timeout: 22,
                               max_retries: 0) { |http| http.request(request) }
    return grammar_unavailable unless response.is_a?(Net::HTTPOK) && response.body && response.body.bytesize <= 40000

    result = JSON.parse(response.body)
    text = result['text']
    return grammar_unavailable unless result['model'] == MODEL && text.is_a?(String) && !text.strip.empty?

    { message: text }
  rescue IOError, SystemCallError, SocketError, Timeout::Error, OpenSSL::SSL::SSLError, JSON::ParserError
    grammar_unavailable
  end

  def grammar_unavailable
    { error: 'Grammar assistance is temporarily unavailable.' }
  end
end

Rails.application.config.to_prepare do
  Captain::RewriteService.prepend(OsplusPhantomGrammar) unless Captain::RewriteService < OsplusPhantomGrammar
end
