import Foundation

struct CharacterDTO: Decodable, Identifiable {
    let id: Int
    let name: String
    let description: String?
    let avatarUrl: String?
    let backstory: String?
    let traits: [String]?
    let category: String?
    let likeCount: Int?
    let chatCount: Int?
    let viewCount: Int?
    let trendingScore: Double?

    private enum CodingKeys: String, CodingKey {
        case id, name, description, backstory, traits, category
        case avatarUrl
        case likeCount, chatCount, viewCount, trendingScore
    }
}

struct EnrichedChatDTO: Decodable, Identifiable {
    struct CharacterSummary: Decodable {
        let id: Int
        let name: String
        let avatarUrl: String?
        let description: String?
    }

    struct LastMessageDTO: Decodable {
        let role: String
        let content: String
        let timestamp: String?
    }

    let id: Int
    let uuid: UUID?
    let userId: Int
    let characterId: Int
    let title: String
    let createdAt: String?
    let updatedAt: String?
    let idempotencyKey: String?
    let character: CharacterSummary?
    let lastMessage: LastMessageDTO?
    let messageCount: Int?
}

struct ChatMessageDTO: Decodable, Identifiable {
    let id: Int
    let uuid: UUID?
    let chatId: Int
    let role: String
    let content: String
    let timestamp: String
}

struct ChatGenerationSuccessDTO: Decodable {
    let message: ChatMessageDTO
}

struct ChatStateDTO: Decodable {
    let chatId: Int
    let state: [String: CharacterStateValueDTO]
    let updatedAt: String?
}

enum CharacterStateValueDTO: Decodable {
    case text(String)
    case quantified(Quantified)

    struct Quantified: Decodable {
        let value: Double?
        let description: String
    }

    init(from decoder: Decoder) throws {
        if let quantified = try? Quantified(from: decoder) {
            self = .quantified(quantified)
            return
        }
        let container = try decoder.singleValueContainer()
        if let text = try? container.decode(String.self) {
            self = .text(text)
            return
        }
        self = .text("")
    }

    var descriptionText: String {
        switch self {
        case .text(let text):
            return text
        case .quantified(let quantified):
            return quantified.description
        }
    }

    var scoreValue: Int? {
        switch self {
        case .text:
            return nil
        case .quantified(let quantified):
            guard let value = quantified.value else { return nil }
            return Int(round(value))
        }
    }
}

struct ChatDTO: Decodable, Identifiable {
    let id: Int
    let uuid: UUID?
    let userId: Int
    let characterId: Int
    let title: String
    let createdAt: String?
    let updatedAt: String?
}

struct UserAccountDTO: Decodable, Identifiable {
    let id: Int
    let username: String
    let email: String?
    let avatarUrl: String?
    let createdAt: String?
}

struct AuthSession {
    let accessToken: String
    let refreshToken: String
}

struct UserStatsDTO: Decodable {
    let totalChats: Int
    let totalMessages: Int
    let uniqueCharacters: Int
    let createdCharacters: Int
    let memberSince: String?
}

struct UserTokenBalanceDTO: Decodable {
    let userId: Int
    let balance: Int
    let createdAt: String?
    let updatedAt: String?
}

struct CharacterCreationPayload: Encodable {
    var name: String
    var description: String
    var avatarURL: String?
    var backstory: String
    var personaPrompt: String
    var voiceStyle: String
    var traits: [String]
    var category: String
    var categories: [String]
    var gender: String
    var nsfwLevel: Int
    var age: Int?
    var conversationStyle: String
    var isPublic: Bool = true

    enum CodingKeys: String, CodingKey {
        case name, description, backstory, traits, category, categories, gender, age
        case avatarURL = "avatar_url"
        case personaPrompt = "persona_prompt"
        case voiceStyle = "voice_style"
        case nsfwLevel = "nsfw_level"
        case conversationStyle = "conversation_style"
        case isPublic = "is_public"
    }
}

struct GeneratedAvatarResponse: Decodable {
    let avatarUrl: String
}

struct UploadAvatarResponse: Decodable {
    let avatarUrl: String
}

private struct SupabaseAuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String

    private enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
    }
}

enum APIClient {
    enum APIError: Error {
        case invalidResponse
        case httpError(Int)
        case invalidConfiguration(String)
    }

    private static let authTokenStorageKey = "yy_apiToken"
    private static let refreshTokenStorageKey = "yy_refreshToken"

    static var authorizationToken: String? {
        get { UserDefaults.standard.string(forKey: authTokenStorageKey) }
        set {
            if let token = newValue, !token.isEmpty {
                UserDefaults.standard.set(token, forKey: authTokenStorageKey)
            } else {
                UserDefaults.standard.removeObject(forKey: authTokenStorageKey)
            }
        }
    }

    static var refreshToken: String? {
        get { UserDefaults.standard.string(forKey: refreshTokenStorageKey) }
        set {
            if let token = newValue, !token.isEmpty {
                UserDefaults.standard.set(token, forKey: refreshTokenStorageKey)
            } else {
                UserDefaults.standard.removeObject(forKey: refreshTokenStorageKey)
            }
        }
    }

    static var baseURL: URL {
        #if DEBUG
        return URL(string: "http://127.0.0.1:8000/api")!
        #else
        return URL(string: "https://api.yourdomain.com/api")!
        #endif
    }

    private static var supabaseAuthBaseURL: URL? = {
        guard let raw = Bundle.main.infoDictionary?["SupabaseURL"] as? String,
              let base = URL(string: raw)
        else { return nil }
        return base.appendingPathComponent("auth/v1")
    }()

    private static var supabaseAnonKey: String? = Bundle.main.infoDictionary?["SupabaseAnonKey"] as? String
    private static var supabaseRedirectURL: String? = Bundle.main.infoDictionary?["SupabaseRedirectURL"] as? String
    private static var oauthRedirectURL: URL? = {
        guard let raw = supabaseRedirectURL else { return nil }
        return URL(string: raw)
    }()
    static var oauthCallbackScheme: String? = oauthRedirectURL?.scheme

    private static func makeRequest(path: String) -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.setValue("zh", forHTTPHeaderField: "Accept-Language")
        if let token = authorizationToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    static func fetchCharacters() async throws -> [CharacterDTO] {
        let request = makeRequest(path: "characters")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        return try decoder.decode([CharacterDTO].self, from: data)
    }

    static func fetchChats() async throws -> [EnrichedChatDTO] {
        let request = makeRequest(path: "chats")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode([EnrichedChatDTO].self, from: data)
    }

    static func fetchCurrentUser() async throws -> UserAccountDTO {
        let request = makeRequest(path: "auth/me")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(UserAccountDTO.self, from: data)
    }

    static func supabaseLogin(email: String, password: String) async throws -> AuthSession {
        let payload = ["email": email, "password": password]
        let response = try await performSupabaseTokenRequest(grantType: "password", payload: payload)
        return AuthSession(accessToken: response.accessToken, refreshToken: response.refreshToken)
    }

    static func refreshSession(refreshToken: String) async throws -> AuthSession {
        let payload = ["refresh_token": refreshToken]
        let response = try await performSupabaseTokenRequest(grantType: "refresh_token", payload: payload)
        return AuthSession(accessToken: response.accessToken, refreshToken: response.refreshToken)
    }

    static func clearSession() {
        authorizationToken = nil
        refreshToken = nil
    }

    static func requestPasswordReset(email: String) async throws {
        guard let base = supabaseAuthBaseURL, let anonKey = supabaseAnonKey else {
            throw APIError.invalidConfiguration("Supabase 未配置，无法发送重置邮件")
        }

        var request = URLRequest(url: base.appendingPathComponent("recover"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue(anonKey, forHTTPHeaderField: "Authorization")
        var payload: [String: Any] = ["email": email]
        if let redirect = supabaseRedirectURL, !redirect.isEmpty {
            payload["redirect_to"] = redirect
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
    }

    static func fetchMessages(chatIdentifier: String) async throws -> [ChatMessageDTO] {
        let request = makeRequest(path: "chats/\(chatIdentifier)/messages")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode([ChatMessageDTO].self, from: data)
    }

    static func createChat(characterId: Int, title: String, idempotencyKey: String? = nil) async throws -> ChatDTO {
        var request = makeRequest(path: "chats")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var payload: [String: Any] = ["characterId": characterId, "title": title]
        if let key = idempotencyKey { payload["idempotencyKey"] = key }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(ChatDTO.self, from: data)
    }

    static func postMessage(chatIdentifier: String, content: String) async throws -> ChatMessageDTO {
        var request = makeRequest(path: "chats/\(chatIdentifier)/messages")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["role": "user", "content": content], options: [])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(ChatMessageDTO.self, from: data)
    }

    static func requestAIResponse(chatIdentifier: String) async throws -> ChatMessageDTO {
        var request = makeRequest(path: "chats/\(chatIdentifier)/generate")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let payload = try decoder.decode(ChatGenerationSuccessDTO.self, from: data)
        return payload.message
    }

    static func fetchUserStats() async throws -> UserStatsDTO {
        let request = makeRequest(path: "auth/me/stats")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(UserStatsDTO.self, from: data)
    }

    static func fetchTokenBalance() async throws -> UserTokenBalanceDTO {
        let request = makeRequest(path: "payment/user/tokens")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(UserTokenBalanceDTO.self, from: data)
    }

    static func generateAvatar(prompt: String, name: String, gender: String, style: String) async throws -> String {
        var request = makeRequest(path: "characters/generate-avatar")
        request.httpMethod = "POST"
        let params = "prompt=\(urlEncode(prompt))&character_name=\(urlEncode(name))&gender=\(urlEncode(gender))&style=\(urlEncode(style))"
        request.httpBody = params.data(using: .utf8)
        request.setValue("application/x-www-form-urlencoded; charset=utf-8", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let result = try decoder.decode(GeneratedAvatarResponse.self, from: data)
        return result.avatarUrl
    }

    static func uploadAvatar(data: Data, mimeType: String, filename: String) async throws -> String {
        var request = makeRequest(path: "characters/upload-avatar")
        request.httpMethod = "POST"
        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (responseData, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let result = try decoder.decode(UploadAvatarResponse.self, from: responseData)
        return result.avatarUrl
    }

    private static func urlEncode(_ string: String) -> String {
        string.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? string
    }

    static func createCharacter(payload: CharacterCreationPayload) async throws -> CharacterDTO {
        var request = makeRequest(path: "characters")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let encoder = JSONEncoder()
        let data = try encoder.encode(payload)
        request.httpBody = data
        let (responseData, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(CharacterDTO.self, from: responseData)
    }

    static func googleOAuthURL() throws -> URL {
        guard let base = supabaseAuthBaseURL else {
            throw APIError.invalidConfiguration("未配置 SupabaseURL，无法启动 Google 登录")
        }
        var components = URLComponents(url: base.appendingPathComponent("authorize"), resolvingAgainstBaseURL: false)
        var items = [URLQueryItem(name: "provider", value: "google"), URLQueryItem(name: "scopes", value: "email profile")]
        if let redirect = supabaseRedirectURL {
            items.append(URLQueryItem(name: "redirect_to", value: redirect))
        }
        components?.queryItems = items
        guard let url = components?.url else {
            throw APIError.invalidConfiguration("无法生成 Supabase OAuth 路径")
        }
        return url
    }

    static func fetchChatState(chatIdentifier: String) async throws -> ChatStateDTO {
        let request = makeRequest(path: "chats/\(chatIdentifier)/state")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpError(http.statusCode) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(ChatStateDTO.self, from: data)
    }

    private static func performSupabaseTokenRequest(grantType: String, payload: [String: String]) async throws -> SupabaseAuthResponse {
        guard let base = supabaseAuthBaseURL, let anonKey = supabaseAnonKey else {
            throw APIError.invalidConfiguration("Supabase credentials missing. Add SupabaseURL & SupabaseAnonKey to Info.plist")
        }

        var components = URLComponents(url: base.appendingPathComponent("token"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "grant_type", value: grantType)]
        guard let url = components?.url else { throw APIError.invalidConfiguration("Failed to build Supabase auth URL") }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue(anonKey, forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            print("[Auth] Supabase error: HTTP \(http.statusCode) - \(body)")
            throw APIError.httpError(http.statusCode)
        }
        let decoder = JSONDecoder()
        return try decoder.decode(SupabaseAuthResponse.self, from: data)
    }
}
