//
//  ContentView.swift
//  YY Chat IOS
//
//  Created by Yifan Yang on 2026-01-02.
//

import SwiftUI
import Combine
import UIKit
import AuthenticationServices
import PhotosUI

struct ChatProfile: Identifiable {
    enum Badge {
        case featured, popular, active, newEntry

        var label: String {
            switch self {
            case .featured: return "官方推荐"
            case .popular: return "Popular"
            case .active: return "活跃"
            case .newEntry: return "新角色"
            }
        }

        var tint: Color {
            switch self {
            case .featured: return Color(red: 1.0, green: 0.85, blue: 0.45)
            case .popular: return Color.green
            case .active: return Color.blue
            case .newEntry: return Color.gray
            }
        }

        var icon: String {
            switch self {
            case .featured: return "crown.fill"
            case .popular: return "sparkles"
            case .active: return "bolt.fill"
            case .newEntry: return "wand.and.stars"
            }
        }
    }

    let id = UUID()
    let characterId: Int?
    let name: String
    let tagline: String
    let description: String
    let traits: [String]
    let rating: Double
    let likes: Int
    let chats: Int
    let views: Int
    let badge: Badge
    let heroIcon: String
    let colorStops: [Color]
    let imageURL: URL?
}

struct HeroSlide: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let gradientColors: [Color]
    let overlayIcon: String
}

struct ChatMessage: Identifiable {
    let id: String
    let text: String
    let isFromUser: Bool
    let timestamp: String

    init(id: String = UUID().uuidString, text: String, isFromUser: Bool, timestamp: String) {
        self.id = id
        self.text = text
        self.isFromUser = isFromUser
        self.timestamp = timestamp
    }
}

struct ChatPreview: Identifiable, Hashable {
    let id: String
    let chatId: Int?
    let chatUUID: UUID?
    let characterId: Int?
    let name: String
    let snippet: String
    let timestamp: String
    let avatar: String
    let avatarURL: URL?
    let messageCount: Int?

    init(
        id: String = UUID().uuidString,
        chatId: Int? = nil,
        chatUUID: UUID? = nil,
        characterId: Int? = nil,
        name: String,
        snippet: String,
        timestamp: String,
        avatar: String,
        avatarURL: URL? = nil,
        messageCount: Int? = nil
    ) {
        self.id = id
        self.chatId = chatId
        self.chatUUID = chatUUID
        self.characterId = characterId
        self.name = name
        self.snippet = snippet
        self.timestamp = timestamp
        self.avatar = avatar
        self.avatarURL = avatarURL
        self.messageCount = messageCount
    }
}

struct CharacterStateMetric: Identifiable {
    let id = UUID()
    let key: String
    let title: String
    let detail: String
    let score: Int?
    let accentColors: [Color]
    let accentColor: Color
    let icon: String

    var progress: Double? {
        guard let score else { return nil }
        return Double(score) / 10.0
    }

    var scoreText: String? {
        guard let score else { return nil }
        return "\(score)/10"
    }
}

private struct CharacterStateVisualMeta {
    let title: String
    let icon: String
    let gradient: [Color]
    let accent: Color

    func named(_ text: String) -> CharacterStateVisualMeta {
        CharacterStateVisualMeta(title: text, icon: icon, gradient: gradient, accent: accent)
    }
}

private let stateVisualBase: [String: CharacterStateVisualMeta] = [
    "Emotion": .init(title: "Emotion", icon: "sparkles", gradient: [Color(red: 0.33, green: 0.54, blue: 0.98), Color(red: 0.12, green: 0.22, blue: 0.56)], accent: Color(red: 0.27, green: 0.51, blue: 0.99)),
    "Affection": .init(title: "Affection", icon: "heart.fill", gradient: [Color(red: 0.99, green: 0.42, blue: 0.71), Color(red: 0.86, green: 0.24, blue: 0.53)], accent: Color(red: 0.97, green: 0.44, blue: 0.68)),
    "Trust": .init(title: "Trust", icon: "hand.raised.fill", gradient: [Color(red: 0.99, green: 0.79, blue: 0.36), Color(red: 0.94, green: 0.53, blue: 0.09)], accent: Color(red: 0.95, green: 0.63, blue: 0.18)),
    "Excitement": .init(title: "Excitement", icon: "bolt.fill", gradient: [Color(red: 0.27, green: 0.92, blue: 0.82), Color(red: 0.06, green: 0.62, blue: 0.83)], accent: Color(red: 0.05, green: 0.67, blue: 0.84)),
    "Fatigue": .init(title: "Fatigue", icon: "moon.zzz.fill", gradient: [Color(red: 0.39, green: 0.84, blue: 0.54), Color(red: 0.18, green: 0.62, blue: 0.37)], accent: Color(red: 0.29, green: 0.72, blue: 0.45)),
    "Environment": .init(title: "Environment", icon: "leaf.fill", gradient: [Color(red: 0.93, green: 0.66, blue: 0.99), Color(red: 0.62, green: 0.41, blue: 0.84)], accent: Color(red: 0.7, green: 0.45, blue: 0.86)),
    "Attire": .init(title: "Attire", icon: "figure.arms.open", gradient: [Color(red: 0.78, green: 0.86, blue: 0.99), Color(red: 0.46, green: 0.58, blue: 0.85)], accent: Color(red: 0.54, green: 0.65, blue: 0.93)),
    "Posture": .init(title: "Posture", icon: "figure.wave", gradient: [Color(red: 0.99, green: 0.65, blue: 0.44), Color(red: 0.96, green: 0.44, blue: 0.38)], accent: Color(red: 0.97, green: 0.53, blue: 0.27)),
    "Tone": .init(title: "Tone", icon: "waveform", gradient: [Color(red: 0.74, green: 0.78, blue: 0.98), Color(red: 0.45, green: 0.49, blue: 0.83)], accent: Color(red: 0.58, green: 0.62, blue: 0.9))
]

private let stateAliasMap: [String: String] = [
    "情绪": "Emotion",
    "好感度": "Affection",
    "信任度": "Trust",
    "兴奋度": "Excitement",
    "疲惫度": "Fatigue",
    "环境": "Environment",
    "衣着": "Attire",
    "仪态": "Posture",
    "语气": "Tone"
]

private let stateSortOrder: [String] = [
    "Emotion", "情绪",
    "Affection", "好感度",
    "Trust", "信任度",
    "Excitement", "兴奋度",
    "Fatigue", "疲惫度",
    "Environment", "环境",
    "Attire", "衣着",
    "Posture", "仪态",
    "Tone", "语气"
]

private func metadata(for key: String) -> CharacterStateVisualMeta {
    if let meta = stateVisualBase[key] {
        return meta
    }
    if let alias = stateAliasMap[key], let meta = stateVisualBase[alias] {
        return meta.named(key)
    }
    return CharacterStateVisualMeta(
        title: key,
        icon: "sparkles",
        gradient: [Color(red: 0.36, green: 0.4, blue: 0.74), Color(red: 0.17, green: 0.18, blue: 0.32)],
        accent: Color(red: 0.69, green: 0.52, blue: 0.9)
    )
}

struct DiscoverCategory: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
}

struct DiscoverCharacter: Identifiable {
    let id = UUID()
    let name: String
    let role: String
    let description: String
    let tags: [String]
    let stats: (likes: Int, chats: Int)
    let accent: [Color]
    let badge: String
    let imageURL: URL?
}

struct DiscoverCollection: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let icon: String
    let gradient: [Color]
}

struct ProfileDetails {
    let name: String
    let email: String
    let avatar: String
    let joinedDate: String
    let status: String
    let bio: String
}

struct ProfileStat: Identifiable {
    let id = UUID()
    let label: String
    let value: String
    let description: String
    let icon: String
}

struct ProfileActivity: Identifiable {
    let id = UUID()
    let character: String
    let ago: String
    let summary: String
    let icon: String
}

enum ThemeMode: String, CaseIterable, Identifiable {
    case system = "跟随系统"
    case light = "浅色"
    case dark = "深色"

    var id: String { rawValue }
}

func appBackgroundGradient(for scheme: ColorScheme) -> LinearGradient {
    if scheme == .dark {
        return LinearGradient(colors: [Color(red: 0.03, green: 0.02, blue: 0.04), Color(red: 0.1, green: 0.08, blue: 0.18)], startPoint: .top, endPoint: .bottom)
    }
    return LinearGradient(colors: [Color(red: 0.98, green: 0.98, blue: 1.0), Color(red: 0.9, green: 0.92, blue: 0.99)], startPoint: .top, endPoint: .bottom)
}

func cardBackgroundColor(for scheme: ColorScheme, intensity: Double = 0.04) -> Color {
    if scheme == .dark {
        return Color.white.opacity(intensity)
    }
    return Color.black.opacity(intensity + 0.01)
}

func cardBorderColor(for scheme: ColorScheme) -> Color {
    if scheme == .dark { return Color.white.opacity(0.12) }
    return Color.black.opacity(0.1)
}

func primaryTextColor(for scheme: ColorScheme) -> Color {
    scheme == .dark ? Color.white : Color.black.opacity(0.9)
}

func secondaryTextColor(for scheme: ColorScheme) -> Color {
    scheme == .dark ? Color.white.opacity(0.75) : Color.black.opacity(0.7)
}

func tertiaryTextColor(for scheme: ColorScheme) -> Color {
    scheme == .dark ? Color.white.opacity(0.6) : Color.black.opacity(0.55)
}

struct ProfilePlan {
    let tier: String
    let tokensRemaining: Int
    let renewalDate: String
    let benefits: [String]
}

@MainActor
final class CharacterStore: ObservableObject {
    @Published var profiles: [ChatProfile] = []
    @Published var discoverCharacters: [DiscoverCharacter] = []

    private let gradientPalette: [[Color]] = [
        [Color(red: 0.91, green: 0.32, blue: 0.63), Color(red: 0.67, green: 0.37, blue: 0.99)],
        [Color(red: 0.18, green: 0.69, blue: 0.61), Color(red: 0.07, green: 0.35, blue: 0.42)],
        [Color(red: 0.98, green: 0.64, blue: 0.27), Color(red: 0.69, green: 0.32, blue: 0.15)],
        [Color(red: 0.36, green: 0.21, blue: 0.55), Color(red: 0.72, green: 0.32, blue: 0.85)],
        [Color(red: 0.99, green: 0.52, blue: 0.35), Color(red: 0.75, green: 0.21, blue: 0.32)],
        [Color(red: 0.16, green: 0.57, blue: 0.67), Color(red: 0.06, green: 0.25, blue: 0.36)]
    ]
    private let icons = ["sparkles", "globe.asia.australia.fill", "music.quarternote.3", "wand.and.stars", "bolt.fill"]

    func loadCharacters() async {
        do {
            let dtos = try await APIClient.fetchCharacters()
            profiles = dtos.enumerated().map { index, dto in
                mapToChatProfile(dto, index: index)
            }
            discoverCharacters = dtos.enumerated().map { index, dto in
                mapToDiscoverCharacter(dto, index: index)
            }
        } catch {
            print("[Characters] Failed to fetch: \(error)")
        }
    }

    private func mapToChatProfile(_ dto: CharacterDTO, index: Int) -> ChatProfile {
        let colors = gradientPalette[index % gradientPalette.count]
        let badge = badgeForCounts(likes: dto.likeCount ?? 0, chats: dto.chatCount ?? 0)
        let icon = icons[index % icons.count]
        return ChatProfile(
            characterId: dto.id,
            name: dto.name,
            tagline: dto.category ?? "多语言 AI 伙伴",
            description: dto.description ?? dto.backstory ?? "这个角色正在完善中。",
            traits: dto.traits ?? [],
            rating: 4.8,
            likes: dto.likeCount ?? 0,
            chats: dto.chatCount ?? 0,
            views: dto.viewCount ?? 0,
            badge: badge,
            heroIcon: icon,
            colorStops: colors,
            imageURL: dto.avatarUrl.flatMap { URL(string: $0) }
        )
    }

    private func mapToDiscoverCharacter(_ dto: CharacterDTO, index: Int) -> DiscoverCharacter {
        let colors = gradientPalette[index % gradientPalette.count]
        let badge = badgeForCounts(likes: dto.likeCount ?? 0, chats: dto.chatCount ?? 0)
        return DiscoverCharacter(
            name: dto.name,
            role: dto.category ?? "AI 角色",
            description: dto.description ?? dto.backstory ?? "这个角色正在完善中。",
            tags: dto.traits ?? [],
            stats: (likes: dto.likeCount ?? 0, chats: dto.chatCount ?? 0),
            accent: colors,
            badge: badge.label,
            imageURL: dto.avatarUrl.flatMap { URL(string: $0) }
        )
    }

    private func badgeForCounts(likes: Int, chats: Int) -> ChatProfile.Badge {
        if likes > 1500 || chats > 3000 { return .featured }
        if chats > 1500 { return .popular }
        if likes > 500 { return .active }
        return .newEntry
    }
}

@MainActor
final class AuthStore: NSObject, ObservableObject {
    @Published private(set) var currentUser: UserAccountDTO?
    @Published private(set) var isAuthenticated = false
    @Published private(set) var userStats: UserStatsDTO?
    @Published private(set) var tokenBalance: UserTokenBalanceDTO?
    @Published var isWorking = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    private var hasAttemptedRestore = false
    private var webAuthSession: ASWebAuthenticationSession?

    func restoreSession() async {
        guard !hasAttemptedRestore else { return }
        hasAttemptedRestore = true
        guard let token = APIClient.authorizationToken, !token.isEmpty else {
            isAuthenticated = false
            return
        }
        await validateExistingSession()
    }

    func login(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else { return }
        isWorking = true
        errorMessage = nil
        successMessage = nil
        do {
            let session = try await APIClient.supabaseLogin(email: email, password: password)
            APIClient.authorizationToken = session.accessToken
            APIClient.refreshToken = session.refreshToken
            try await fetchProfile()
        } catch let error {
            errorMessage = "登录失败：\(errorMessageDescription(error))"
            APIClient.clearSession()
            isAuthenticated = false
        }
        isWorking = false
    }

    func adoptExistingToken(_ token: String) async {
        guard !token.isEmpty else { return }
        APIClient.authorizationToken = token
        APIClient.refreshToken = nil
        successMessage = nil
        await validateExistingSession()
    }

    func logout() {
        APIClient.clearSession()
        currentUser = nil
        isAuthenticated = false
        userStats = nil
        tokenBalance = nil
        errorMessage = nil
        successMessage = nil
        hasAttemptedRestore = false
    }

    func sendPasswordReset(to email: String) async {
        guard !email.isEmpty else {
            errorMessage = "请输入邮箱地址"
            return
        }
        isWorking = true
        errorMessage = nil
        successMessage = nil
        do {
            try await APIClient.requestPasswordReset(email: email)
            successMessage = "重置邮件已发送到 \(email)"
        } catch {
            errorMessage = errorMessageDescription(error)
        }
        isWorking = false
    }

    func loginWithGoogle() {
        guard !isWorking else { return }
        guard let authURL = try? APIClient.googleOAuthURL(), let scheme = APIClient.oauthCallbackScheme else {
            errorMessage = "缺少 Supabase 配置，无法发起 Google 登录"
            return
        }
        errorMessage = nil
        isWorking = true
        let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: scheme) { [weak self] callbackURL, error in
            Task {
                await self?.handleOAuthCallback(url: callbackURL, error: error)
            }
        }
        session.prefersEphemeralWebBrowserSession = true
        session.presentationContextProvider = self
        if !session.start() {
            isWorking = false
            errorMessage = "无法打开 Google 登录窗口"
            return
        }
        webAuthSession = session
    }

    private func validateExistingSession() async {
        do {
            try await fetchProfile()
        } catch {
            await attemptRefresh()
        }
    }

    private func fetchProfile() async throws {
        let profile = try await APIClient.fetchCurrentUser()
        currentUser = profile
        isAuthenticated = true
        errorMessage = nil
        await loadUserContext()
    }

    private func attemptRefresh() async {
        guard let refreshToken = APIClient.refreshToken, !refreshToken.isEmpty else {
            APIClient.clearSession()
            currentUser = nil
            isAuthenticated = false
            return
        }

        do {
            let session = try await APIClient.refreshSession(refreshToken: refreshToken)
            APIClient.authorizationToken = session.accessToken
            APIClient.refreshToken = session.refreshToken
            try await fetchProfile()
        } catch {
            APIClient.clearSession()
            currentUser = nil
            isAuthenticated = false
            errorMessage = "会话已失效，请重新登录"
        }
    }

    private func errorMessageDescription(_ error: Error) -> String {
        if case APIClient.APIError.httpError(let status) = error {
            switch status {
            case 400: return "邮箱或密码错误"
            case 401: return "认证失败"
            default: return "服务器响应 \(status)"
            }
        }
        if case APIClient.APIError.invalidConfiguration(let reason) = error {
            return reason
        }
        return error.localizedDescription
    }

    private func handleOAuthCallback(url: URL?, error: Error?) async {
        defer {
            Task { @MainActor in
                self.isWorking = false
                self.webAuthSession = nil
            }
        }
        if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
            await MainActor.run {
                self.errorMessage = "已取消登录"
            }
            return
        }
        if let error, (error as NSError).code != ASWebAuthenticationSessionError.canceledLogin.rawValue {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
            }
            return
        }
        guard let url = url else {
            await MainActor.run { self.errorMessage = "未能获取登录回调" }
            return
        }
        let params = parseOAuthFragment(url: url)
        guard let access = params["access_token"], let refresh = params["refresh_token"] else {
            await MainActor.run { self.errorMessage = "Supabase 未返回访问令牌" }
            return
        }
        APIClient.authorizationToken = access
        APIClient.refreshToken = refresh
        do {
            try await fetchProfile()
            await MainActor.run {
                self.successMessage = "已通过 Google 登录"
            }
        } catch {
            await MainActor.run {
                self.errorMessage = self.errorMessageDescription(error)
            }
        }
    }

    private func parseOAuthFragment(url: URL) -> [String: String] {
        guard let fragment = url.fragment else { return [:] }
        let pairs = fragment.split(separator: "&")
        var dict: [String: String] = [:]
        for pair in pairs {
            let parts = pair.split(separator: "=", maxSplits: 1)
            guard parts.count == 2 else { continue }
            let key = String(parts[0])
            let value = String(parts[1]).removingPercentEncoding ?? String(parts[1])
            dict[key] = value
        }
        return dict
    }

    private func loadUserContext() async {
        async let statsResult = try? APIClient.fetchUserStats()
        async let tokenResult = try? APIClient.fetchTokenBalance()
        let stats = await statsResult
        let tokens = await tokenResult
        await MainActor.run {
            if let stats { self.userStats = stats }
            if let tokens { self.tokenBalance = tokens }
        }
    }
}

extension AuthStore: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
           let window = windowScene.windows.first(where: { $0.isKeyWindow }) {
            return window
        }
        if let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState != .unattached }),
           let window = windowScene.windows.first {
            return window
        }
        return ASPresentationAnchor()
    }
}

@MainActor
final class ChatStore: ObservableObject {
    @Published var previews: [ChatPreview] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let avatarFallbacks = ["sparkles", "globe", "music.note", "heart.fill", "bolt.fill", "leaf.fill"]
    private let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        let localeIdentifier = Locale.preferredLanguages.first ?? Locale.current.identifier
        formatter.locale = Locale(identifier: localeIdentifier)
        return formatter
    }()

    private let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private let iso8601Basic = ISO8601DateFormatter()

    func loadChats(force: Bool = false) async {
        if isLoading && !force { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let dtos = try await APIClient.fetchChats()
            let mapped = dtos.enumerated().map { index, dto in
                mapToPreview(dto, index: index)
            }
            previews = mapped
            errorMessage = nil
        } catch {
            print("[Chats] Failed to fetch: \(error)")
            if previews.isEmpty {
                errorMessage = errorMessage(for: error)
            }
        }
    }

    private func mapToPreview(_ dto: EnrichedChatDTO, index: Int) -> ChatPreview {
        let snippet = dto.lastMessage?.content ?? dto.character?.description ?? dto.title
        let avatarURL = dto.character?.avatarUrl.flatMap { URL(string: $0) }
        let timestamp = relativeTimestamp(from: dto.lastMessage?.timestamp ?? dto.updatedAt ?? dto.createdAt)
        let fallbackSymbol = avatarFallbacks[index % avatarFallbacks.count]
        return ChatPreview(
            id: dto.uuid?.uuidString ?? "chat-\(dto.id)",
            chatId: dto.id,
            chatUUID: dto.uuid,
            characterId: dto.characterId,
            name: dto.character?.name ?? dto.title,
            snippet: snippet,
            timestamp: timestamp,
            avatar: fallbackSymbol,
            avatarURL: avatarURL,
            messageCount: dto.messageCount
        )
    }

    private func relativeTimestamp(from isoString: String?) -> String {
        guard let date = parseDate(isoString) else { return "刚刚" }
        let relative = relativeFormatter.localizedString(for: date, relativeTo: Date())
        return relative
    }

    private func parseDate(_ isoString: String?) -> Date? {
        guard let isoString else { return nil }
        if let date = iso8601WithFractional.date(from: isoString) {
            return date
        }
        return iso8601Basic.date(from: isoString)
    }

    private func errorMessage(for error: Error) -> String {
        if case APIClient.APIError.httpError(let code) = error {
            switch code {
            case 401:
                return "需要有效的登录令牌才能同步聊天记录"
            case 403:
                return "没有权限访问当前账号的聊天记录"
            default:
                return "服务器返回错误 (\(code))"
            }
        }
        return error.localizedDescription
    }

    func createChat(for profile: ChatProfile) async throws -> ChatPreview {
        guard let characterId = profile.characterId else {
            throw APIClient.APIError.invalidConfiguration("该角色尚未同步 ID，无法创建会话")
        }
        let idempotencyKey = UUID().uuidString
        let dto = try await APIClient.createChat(characterId: characterId, title: profile.name, idempotencyKey: idempotencyKey)
        let newPreview = ChatPreview(
            id: dto.uuid?.uuidString ?? "chat-\(dto.id)",
            chatId: dto.id,
            chatUUID: dto.uuid,
            characterId: characterId,
            name: profile.name,
            snippet: profile.description,
            timestamp: "刚刚",
            avatar: profile.heroIcon,
            avatarURL: profile.imageURL,
            messageCount: 0
        )
        await loadChats(force: true)
        return newPreview
    }
}

@MainActor
final class ChatDetailViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var isSending = false
    @Published var isGenerating = false
    @Published var errorMessage: String?
    @Published var stateMetrics: [CharacterStateMetric] = []
    @Published var isLoadingState = false
    @Published var stateErrorMessage: String?
    @Published var stateUpdatedText: String?

    let preview: ChatPreview
    private var hasLoadedMessages = false
    private var hasLoadedState = false

    private let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private let iso8601Basic = ISO8601DateFormatter()
    private let stateTimestampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: Locale.preferredLanguages.first ?? Locale.current.identifier)
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    private let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter
    }()

    init(preview: ChatPreview) {
        self.preview = preview
    }

    var companionName: String { preview.name }

    private var chatIdentifier: String? {
        if let uuid = preview.chatUUID { return uuid.uuidString }
        if let id = preview.chatId { return String(id) }
        return nil
    }

    func loadMessages(force: Bool = false) async {
        if hasLoadedMessages && !force { return }
        guard let identifier = chatIdentifier else {
            errorMessage = "无法定位该对话的 ID"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let dtos = try await APIClient.fetchMessages(chatIdentifier: identifier)
            messages = dtos.map(mapMessage)
            hasLoadedMessages = true
            errorMessage = nil
        } catch {
            errorMessage = friendlyMessage(for: error)
        }
    }

    func loadCharacterState(force: Bool = false) async {
        if hasLoadedState && !force { return }
        guard let identifier = chatIdentifier else {
            stateErrorMessage = "无法定位该对话的 ID"
            return
        }
        isLoadingState = true
        defer { isLoadingState = false }
        do {
            let dto = try await APIClient.fetchChatState(chatIdentifier: identifier)
            stateMetrics = mapStateMetrics(dto)
            stateUpdatedText = formattedStateDate(from: dto.updatedAt)
            stateErrorMessage = stateMetrics.isEmpty ? "暂无可展示的状态" : nil
            hasLoadedState = true
        } catch {
            stateErrorMessage = friendlyMessage(for: error)
        }
    }

    func sendMessage(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let identifier = chatIdentifier else {
            errorMessage = "无法定位该对话的 ID"
            return
        }
        isSending = true
        defer { isSending = false }
        do {
            let dto = try await APIClient.postMessage(chatIdentifier: identifier, content: trimmed)
            messages.append(mapMessage(dto))
            errorMessage = nil
            await generateAIResponse(identifier: identifier)
        } catch {
            errorMessage = friendlyMessage(for: error)
        }
    }

    private func generateAIResponse(identifier: String) async {
        isGenerating = true
        defer { isGenerating = false }
        do {
            let dto = try await APIClient.requestAIResponse(chatIdentifier: identifier)
            messages.append(mapMessage(dto))
            await loadCharacterState(force: true)
        } catch {
            errorMessage = friendlyMessage(for: error)
        }
    }

    func regenerateResponse(for message: ChatMessage) async {
        guard !message.isFromUser, let identifier = chatIdentifier else { return }
        await MainActor.run {
            messages.removeAll { $0.id == message.id }
            isGenerating = true
            errorMessage = nil
        }
        do {
            let dto = try await APIClient.requestAIResponse(chatIdentifier: identifier)
            await MainActor.run {
                messages.append(mapMessage(dto))
                isGenerating = false
            }
            await loadCharacterState(force: true)
        } catch {
            await MainActor.run {
                errorMessage = friendlyMessage(for: error)
                isGenerating = false
            }
        }
    }

    private func mapMessage(_ dto: ChatMessageDTO) -> ChatMessage {
        let timestamp = formattedTimestamp(from: dto.timestamp)
        let identifier = dto.uuid?.uuidString ?? "msg-\(dto.id)"
        return ChatMessage(id: identifier, text: dto.content, isFromUser: dto.role.lowercased() == "user", timestamp: timestamp)
    }

    private func mapStateMetrics(_ dto: ChatStateDTO) -> [CharacterStateMetric] {
        let metrics = dto.state.compactMap { key, value -> CharacterStateMetric? in
            let trimmed = value.descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            let meta = metadata(for: key)
            return CharacterStateMetric(
                key: key,
                title: meta.title,
                detail: trimmed,
                score: value.scoreValue,
                accentColors: meta.gradient,
                accentColor: meta.accent,
                icon: meta.icon
            )
        }

        return metrics.sorted { lhs, rhs in
            let lhsIndex = stateSortOrder.firstIndex(of: lhs.key) ?? stateSortOrder.count
            let rhsIndex = stateSortOrder.firstIndex(of: rhs.key) ?? stateSortOrder.count
            if lhsIndex == rhsIndex {
                return lhs.title < rhs.title
            }
            return lhsIndex < rhsIndex
        }
    }

    private func formattedTimestamp(from iso: String) -> String {
        if let date = iso8601WithFractional.date(from: iso) ?? iso8601Basic.date(from: iso) {
            return timeFormatter.string(from: date)
        }
        return iso
    }

    private func formattedStateDate(from iso: String?) -> String? {
        guard let iso else { return nil }
        if let date = iso8601WithFractional.date(from: iso) ?? iso8601Basic.date(from: iso) {
            return stateTimestampFormatter.string(from: date)
        }
        return nil
    }

    private func friendlyMessage(for error: Error) -> String {
        if case APIClient.APIError.httpError(let code) = error {
            switch code {
            case 401: return "登录状态失效，请重新登录"
            case 403: return "没有权限读取此对话"
            case 404: return "未找到该对话"
            default: return "服务器返回错误 (\(code))"
            }
        }
        if case APIClient.APIError.invalidConfiguration(let reason) = error {
            return reason
        }
        return error.localizedDescription
    }
}

struct ContentView: View {
    @AppStorage("yy_themeMode") private var themeMode: String = ThemeMode.system.rawValue
    @StateObject private var characterStore = CharacterStore()
    @StateObject private var chatStore = ChatStore()
    @StateObject private var authStore = AuthStore()
    @State private var localhostReachable = false
    @State private var showLoginSheet = false
    @State private var selectedTab = 0
    @State private var activeChatPreview: ChatPreview?

    private let fallbackProfiles: [ChatProfile] = [
        .init(
            characterId: nil,
            name: "Nova",
            tagline: "创意策略 · 沉浸式陪伴",
            description: "具备品牌历史记忆与趋势洞察，擅长将模糊灵感变成完整 campaign blueprints。",
            traits: ["剧情深潜", "品牌语感", "视觉提案"],
            rating: 4.9,
            likes: 1280,
            chats: 450,
            views: 8900,
            badge: .featured,
            heroIcon: "sparkles",
            colorStops: [Color(red: 0.91, green: 0.32, blue: 0.63), Color(red: 0.67, green: 0.37, blue: 0.99)],
            imageURL: nil
        ),
        .init(
            characterId: nil,
            name: "Atlas",
            tagline: "增长黑客 · 市场动能捕捉",
            description: "实时关注市场信息流，为新产品设计 launch blueprint 与跨渠道分发节奏。",
            traits: ["Go-To-Market", "数据复盘"],
            rating: 4.7,
            likes: 980,
            chats: 320,
            views: 6400,
            badge: .popular,
            heroIcon: "globe.asia.australia.fill",
            colorStops: [Color(red: 0.18, green: 0.69, blue: 0.61), Color(red: 0.07, green: 0.35, blue: 0.42)],
            imageURL: nil
        ),
        .init(
            characterId: nil,
            name: "Lyric",
            tagline: "故事 IP · 文案共创",
            description: "能够模仿不同语气写作，打磨 slogan、脚本与长文案，适配社交或私域风格。",
            traits: ["语气克隆", "脚本润色", "私域风格"],
            rating: 4.8,
            likes: 760,
            chats: 210,
            views: 5200,
            badge: .active,
            heroIcon: "music.quarternote.3",
            colorStops: [Color(red: 0.98, green: 0.64, blue: 0.27), Color(red: 0.69, green: 0.32, blue: 0.15)],
            imageURL: nil
        )
    ]

    private let previewMessages: [ChatMessage] = [
        .init(text: "Nova：我们要不要把品牌故事拆成三个章节来聊？", isFromUser: false, timestamp: "09:25"),
        .init(text: "好，想先锁定 campaign 主题，还是先看视觉锚点？", isFromUser: true, timestamp: "09:26"),
        .init(text: "我会先生成一套 slogan + key visual moodboard。", isFromUser: false, timestamp: "09:27")
    ]

    private let chatDrafts: [ChatPreview] = [
        .init(name: "Nova", snippet: "我们可以直接把视觉 moodboard 拆成三层结构。", timestamp: "刚刚", avatar: "sparkles"),
        .init(name: "Atlas", snippet: "Launch 日程我已经生成了一个 Gantt 草案。", timestamp: "2小时前", avatar: "globe.asia.australia.fill"),
        .init(name: "Lyric", snippet: "我能把 slogan 拓展成 10 条备用。", timestamp: "昨天", avatar: "music.quarternote.3")
    ]

    private let discoverCategories: [DiscoverCategory] = [
        .init(name: "剧情冒险", icon: "sparkles"),
        .init(name: "情感陪伴", icon: "heart.fill"),
        .init(name: "学习助教", icon: "book.fill"),
        .init(name: "科幻赛博", icon: "globe"),
        .init(name: "日常治愈", icon: "sun.min.fill"),
        .init(name: "神秘灵异", icon: "moon.stars.fill")
    ]

    private let fallbackDiscoverCharacters: [DiscoverCharacter] = [
        .init(name: "Elara", role: "星际调度官", description: "兼具战略判断与温柔陪伴，擅长把复杂任务拆解成可执行步骤。", tags: ["任务指挥", "长期陪伴"], stats: (likes: 1210, chats: 3820), accent: [Color(red: 0.36, green: 0.21, blue: 0.55), Color(red: 0.72, green: 0.32, blue: 0.85)], badge: "TRENDING", imageURL: nil),
        .init(name: "Maya", role: "故事光影导演", description: "善用视觉语言与对白节奏，适合打造互动短剧与广告脚本。", tags: ["脚本", "分镜"], stats: (likes: 960, chats: 2100), accent: [Color(red: 0.99, green: 0.52, blue: 0.35), Color(red: 0.75, green: 0.21, blue: 0.32)], badge: "NEW", imageURL: nil),
        .init(name: "Drift", role: "赛博情报贩", description: "实时抓取资讯流，整理市场动向与舆情变化。", tags: ["情报", "策略"], stats: (likes: 640, chats: 1480), accent: [Color(red: 0.16, green: 0.57, blue: 0.67), Color(red: 0.06, green: 0.25, blue: 0.36)], badge: "HOT", imageURL: nil),
    ]

    private let discoverCollections: [DiscoverCollection] = [
        .init(title: "品牌战役精选", detail: "14 个角色构建 campaign 宏观-执行全链", icon: "megaphone.fill", gradient: [Color(red: 0.87, green: 0.35, blue: 0.6), Color(red: 0.65, green: 0.32, blue: 0.91)]),
        .init(title: "沉浸式恋爱体验", detail: "体验 6 种不同风格的情感陪伴", icon: "heart.circle.fill", gradient: [Color(red: 0.98, green: 0.52, blue: 0.39), Color(red: 0.94, green: 0.25, blue: 0.36)]),
        .init(title: "学习共创实验室", detail: "笔记整理 + 课堂互动 + 论文迭代", icon: "graduationcap.fill", gradient: [Color(red: 0.3, green: 0.59, blue: 0.94), Color(red: 0.09, green: 0.21, blue: 0.49)])
    ]

    private let profileDetails = ProfileDetails(
        name: "Yifan Yang",
        email: "yifan@intellispark.ai",
        avatar: "person.crop.circle.fill",
        joinedDate: "2024-05-12",
        status: "Active",
        bio: "好奇心驱动的创意研究者，喜欢把 AI 角色当作创作伙伴。"
    )

    private let fallbackProfilePlan = ProfilePlan(
        tier: "Creator Pro",
        tokensRemaining: 2450,
        renewalDate: "2024-11-05",
        benefits: ["角色上架收益分成", "高级提示词库", "优先客服"]
    )

    private let fallbackProfileStats: [ProfileStat] = [
        .init(label: "总会话", value: "128", description: "累计对话次数", icon: "message.fill"),
        .init(label: "角色数", value: "42", description: "互动过的角色", icon: "person.3.fill"),
        .init(label: "Tokens", value: "2,450", description: "可用创作点数", icon: "bolt.fill")
    ]

    private let profileActivities: [ProfileActivity] = [
        .init(character: "Nova", ago: "5 分钟前", summary: "继续品牌故事共创", icon: "sparkles"),
        .init(character: "Atlas", ago: "2 小时前", summary: "同步 launch 排期", icon: "globe"),
        .init(character: "Lyric", ago: "昨天", summary: "润色 campaign slogan", icon: "music.note")
    ]

    private let isoDateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private let profileDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter
    }()

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(profiles: currentProfiles, onRequireLogin: { showLoginSheet = true }, onChatCreated: handleChatCreated)
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Home")
                }
                .tag(0)

            ChatsListView(
                chatPreviews: currentChats,
                messageSeed: previewMessages,
                isLoading: chatStore.isLoading,
                isUsingFallback: isShowingFallbackChats,
                errorMessage: chatStore.errorMessage,
                isAuthenticated: authStore.isAuthenticated,
                onLoginTap: { showLoginSheet = true },
                selectedPreview: $activeChatPreview,
                onRefresh: {
                    await chatStore.loadChats()
                }
            )
                .tabItem {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                    Text("Chats")
                }
                .tag(1)

            CharacterCreationScreen(
                onCreated: { _ in
                    Task { await characterStore.loadCharacters() }
                },
                onRequireLogin: { showLoginSheet = true },
                onChatCreated: handleChatCreated
            )
                .tabItem {
                    Image(systemName: "plus.circle.fill")
                    Text("Create")
                }
                .tag(2)

            DiscoverView(categories: discoverCategories, trending: currentDiscoverCharacters, collections: discoverCollections)
                .tabItem {
                    Image(systemName: "heart.fill")
                    Text("Discover")
                }
                .tag(3)

            ProfileView(
                details: resolvedProfileDetails,
                plan: resolvedProfilePlan,
                stats: resolvedProfileStats,
                activities: profileActivities,
                themeMode: $themeMode,
                isAuthenticated: authStore.isAuthenticated,
                onLoginTap: { showLoginSheet = true }
            )
                .tabItem {
                    Image(systemName: "person.crop.circle")
                    Text("Profile")
                }
                .tag(4)
        }
        .tint(Color(red: 0.96, green: 0.45, blue: 0.71))
        .environmentObject(authStore)
        .environmentObject(chatStore)
        .environmentObject(characterStore)
        .preferredColorScheme(preferredScheme)
        .task {
            await authStore.restoreSession()
            await testLocalhostReachability()
            await characterStore.loadCharacters()
            if authStore.isAuthenticated {
                await chatStore.loadChats()
            }
        }
        .task(id: authStore.isAuthenticated) {
            guard authStore.isAuthenticated else { return }
            await chatStore.loadChats()
        }
        .onChange(of: authStore.isAuthenticated) { _, isLoggedIn in
            if isLoggedIn {
                showLoginSheet = false
            } else {
                chatStore.previews = []
                chatStore.errorMessage = nil
            }
        }
        .sheet(isPresented: $showLoginSheet) {
            LoginView(authStore: authStore)
        }
    }

    private var preferredScheme: ColorScheme? {
        switch ThemeMode(rawValue: themeMode) ?? .system {
        case .system:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }

    private var currentProfiles: [ChatProfile] {
        characterStore.profiles.isEmpty ? fallbackProfiles : characterStore.profiles
    }

    private var currentDiscoverCharacters: [DiscoverCharacter] {
        characterStore.discoverCharacters.isEmpty ? fallbackDiscoverCharacters : characterStore.discoverCharacters
    }

    private var currentChats: [ChatPreview] {
        if chatStore.previews.isEmpty {
            return isShowingFallbackChats ? chatDrafts : []
        }
        return chatStore.previews
    }

    private var isShowingFallbackChats: Bool {
        chatStore.previews.isEmpty && chatStore.errorMessage != nil
    }

    private var resolvedProfileDetails: ProfileDetails {
        guard let user = authStore.currentUser else { return profileDetails }
        return ProfileDetails(
            name: user.username,
            email: user.email ?? profileDetails.email,
            avatar: profileDetails.avatar,
            joinedDate: formattedJoinDate(user.createdAt) ?? profileDetails.joinedDate,
            status: profileDetails.status,
            bio: profileDetails.bio
        )
    }

    private var resolvedProfilePlan: ProfilePlan {
        let base = fallbackProfilePlan
        if let balance = authStore.tokenBalance?.balance {
            return ProfilePlan(
                tier: base.tier,
                tokensRemaining: balance,
                renewalDate: base.renewalDate,
                benefits: base.benefits
            )
        }
        return base
    }

    private var resolvedProfileStats: [ProfileStat] {
        if let stats = authStore.userStats {
            let balance = authStore.tokenBalance?.balance ?? 0
            return [
                ProfileStat(label: "总会话", value: stats.totalChats.formatted(), description: "累计对话次数", icon: "message.fill"),
                ProfileStat(label: "角色数", value: stats.uniqueCharacters.formatted(), description: "互动过的角色", icon: "person.3.fill"),
                ProfileStat(label: "Tokens", value: balance.formatted(), description: "可用创作点数", icon: "bolt.fill")
            ]
        }
        return fallbackProfileStats
    }

    private func formattedJoinDate(_ isoString: String?) -> String? {
        guard let isoString else { return nil }
        if let date = isoDateFormatter.date(from: isoString) {
            return profileDateFormatter.string(from: date)
        }
        return nil
    }

    private func testLocalhostReachability() async {
        guard let url = URL(string: "http://127.0.0.1:8000/api/health") else { return }
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                localhostReachable = (200..<500).contains(httpResponse.statusCode)
                print("[Localhost Test] status: \(httpResponse.statusCode)")
            }
        } catch {
            localhostReachable = false
            print("[Localhost Test] failed: \(error.localizedDescription)")
        }
    }

    private func handleChatCreated(_ preview: ChatPreview) {
        selectedTab = 1
        DispatchQueue.main.async {
            activeChatPreview = preview
        }
    }
}

private struct HomeView: View {
    let profiles: [ChatProfile]
    let onRequireLogin: () -> Void
    let onChatCreated: (ChatPreview) -> Void
    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var chatStore: ChatStore
    private let heroSlides: [HeroSlide] = [
        .init(
            title: "YY Chat Copilot",
            message: "将网页端的角色体验延伸到移动，随时进入沉浸式对话。",
            gradientColors: [Color(red: 0.13, green: 0.12, blue: 0.35), Color(red: 0.56, green: 0.18, blue: 0.33)],
            overlayIcon: "sparkles"
        ),
        .init(
            title: "创意灵感面板",
            message: "收藏的角色、任务与提示将同步，可离线查看草稿。",
            gradientColors: [Color(red: 0.14, green: 0.24, blue: 0.41), Color(red: 0.08, green: 0.58, blue: 0.58)],
            overlayIcon: "bolt.horizontal.circle.fill"
        ),
        .init(
            title: "安全与隐私",
            message: "端到端加密的消息处理，确保角色设定与对话安全。",
            gradientColors: [Color(red: 0.25, green: 0.16, blue: 0.45), Color(red: 0.55, green: 0.25, blue: 0.63)],
            overlayIcon: "lock.shield.fill"
        )
    ]

    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedProfile: ChatProfile?

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                let topInset = proxy.safeAreaInsets.top

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 24) {
                        ImmersiveHero(slides: heroSlides, topInset: topInset)

                        VStack(spacing: 16) {
                            ForEach(profiles) { profile in
                                ProfileCard(profile: profile) {
                                    selectedProfile = profile
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                    .padding(.bottom, 32)
                }
                .ignoresSafeArea(edges: .top)
                .sheet(item: $selectedProfile) { profile in
                    ProfileDetailSheet(
                        profile: profile,
                        onRequireLogin: onRequireLogin,
                        authStore: authStore,
                        chatStore: chatStore,
                        onChatCreated: onChatCreated
                    )
                }
            }
            .background(
                appBackgroundGradient(for: colorScheme)
                    .ignoresSafeArea()
            )
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

private struct ImmersiveHero: View {
    let slides: [HeroSlide]
    let topInset: CGFloat
    @State private var selection = 0

    private var currentColors: [Color] {
        guard slides.indices.contains(selection) else { return slides.first?.gradientColors ?? [.purple, .pink] }
        return slides[selection].gradientColors
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selection) {
                ForEach(Array(slides.enumerated()), id: \.offset) { index, slide in
                    ZStack(alignment: .bottomLeading) {
                        LinearGradient(colors: slide.gradientColors, startPoint: .topLeading, endPoint: .bottomTrailing)
                            .overlay(
                                LinearGradient(colors: [.white.opacity(0.08), .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
                            )

                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Color.white.opacity(0.2))
                                    .frame(width: 48, height: 48)
                                    .overlay(Image(systemName: slide.overlayIcon).foregroundStyle(.white))
                                Text(slide.title)
                                    .font(.headline)
                                    .foregroundStyle(.white)
                            }
                            Text(slide.message)
                                .font(.callout)
                                .foregroundStyle(.white.opacity(0.85))
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 60)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            HeroPageDots(count: slides.count, selection: selection)
                .padding(.bottom, 28)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 320 + topInset)
        .padding(.top, -topInset)
        .background(
            LinearGradient(colors: currentColors, startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .ignoresSafeArea(edges: .top)
    }
}

private struct HeroPageDots: View {
    let count: Int
    let selection: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<count, id: \.self) { index in
                Circle()
                    .fill(index == selection ? Color.white : Color.white.opacity(0.35))
                    .frame(width: index == selection ? 10 : 6, height: 6)
                    .animation(.spring(response: 0.4, dampingFraction: 0.7), value: selection)
            }
        }
    }
}

private struct DiscoverView: View {
    let categories: [DiscoverCategory]
    let trending: [DiscoverCharacter]
    let collections: [DiscoverCollection]
    @State private var selectedCategoryID: UUID?
    @State private var searchText = ""
    @Environment(\.colorScheme) private var colorScheme

    private var filteredCharacters: [DiscoverCharacter] {
        var result = trending
        if !searchText.isEmpty {
            result = result.filter { $0.name.localizedCaseInsensitiveContains(searchText) || $0.description.localizedCaseInsensitiveContains(searchText) }
        }
        if let selectedID = selectedCategoryID,
           let keyword = categories.first(where: { $0.id == selectedID })?.name {
            let key = keyword
            let filtered = result.filter { character in
                character.role.contains(key) || character.tags.contains(where: { $0.contains(key) })
            }
            if !filtered.isEmpty { return filtered }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 28) {
                    DiscoverHero(searchText: $searchText)

                    CategoryScroller(categories: categories, selectedID: $selectedCategoryID)

                    DiscoverSectionHeader(title: "正在热聊", subtitle: "根据互动热度实时刷新")
                        .padding(.horizontal)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 16) {
                            ForEach(filteredCharacters) { character in
                                DiscoverCharacterCard(character: character)
                            }
                        }
                        .padding(.horizontal)
                    }

                    DiscoverSectionHeader(title: "精选合集", subtitle: "策划团队每周更新")
                        .padding(.horizontal)

                    VStack(spacing: 16) {
                        ForEach(collections) { collection in
                            DiscoverCollectionCard(collection: collection)
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 28)
            }
            .background(
                appBackgroundGradient(for: colorScheme)
                    .ignoresSafeArea()
            )
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

private struct DiscoverHero: View {
    @Binding var searchText: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Discover")
                .font(.largeTitle.bold())
                .foregroundStyle(.white)
            Text("灵感、陪伴、剧情与专家顾问都在此集合。找到下一个个性角色。")
                .font(.body)
                .foregroundStyle(.white.opacity(0.85))

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.white.opacity(0.7))
                TextField("搜索角色、风格或关键词", text: $searchText)
                    .textFieldStyle(.plain)
                    .foregroundStyle(.white)
            }
            .padding()
            .background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )

            VStack(alignment: .leading, spacing: 8) {
                Text("TRUSTED BY 320K+ SESSIONS")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
                ProgressView(value: 0.72)
                    .tint(Color.white)
            }
        }
        .padding(24)
        .background(
            LinearGradient(colors: [Color(red: 0.39, green: 0.15, blue: 0.58), Color(red: 0.92, green: 0.34, blue: 0.49)], startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
        .padding(.horizontal)
    }
}

private struct CategoryScroller: View {
    let categories: [DiscoverCategory]
    @Binding var selectedID: UUID?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(categories) { category in
                    Button {
                        selectedID = selectedID == category.id ? nil : category.id
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: category.icon)
                                .font(.footnote)
                            Text(category.name)
                                .font(.subheadline)
                        }
                        .padding(.vertical, 10)
                        .padding(.horizontal, 16)
                        .background(
                            Capsule()
                                .fill(selectedID == category.id ? cardBackgroundColor(for: colorScheme, intensity: 0.2) : cardBackgroundColor(for: colorScheme, intensity: 0.08))
                        )
                        .overlay(
                            Capsule()
                                .stroke(cardBorderColor(for: colorScheme), lineWidth: 1)
                        )
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    }
                }
            }
            .padding(.horizontal)
        }
    }
}

private struct DiscoverSectionHeader: View {
    let title: String
    let subtitle: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.title3.bold())
                .foregroundStyle(primaryTextColor(for: colorScheme))
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(secondaryTextColor(for: colorScheme))
        }
    }
}

private struct DiscoverCharacterCard: View {
    let character: DiscoverCharacter
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(character.badge)
                    .font(.caption2.weight(.semibold))
                    .padding(.vertical, 4)
                    .padding(.horizontal, 10)
                    .background(Color.white.opacity(colorScheme == .dark ? 0.2 : 0.35), in: Capsule())
                Spacer()
                Image(systemName: "star.fill")
                    .foregroundStyle(.yellow)
            }

            Text(character.name)
                .font(.title3.bold())
                .foregroundStyle(Color.white)
            Text(character.role)
                .font(.subheadline)
                .foregroundStyle(Color.white.opacity(0.9))
            Text(character.description)
                .font(.footnote)
                .foregroundStyle(Color.white.opacity(0.85))
                .lineLimit(3)

            HStack(spacing: 8) {
                ForEach(character.tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption)
                        .padding(.vertical, 4)
                        .padding(.horizontal, 10)
                        .background(Color.white.opacity(0.18), in: Capsule())
                }
            }

            HStack {
                Label("\(character.stats.likes)", systemImage: "heart.fill")
                Label("\(character.stats.chats)", systemImage: "message.fill")
            }
            .font(.caption)
            .foregroundStyle(.white.opacity(0.9))
        }
        .padding(20)
        .frame(width: 260, alignment: .leading)
        .background(
            LinearGradient(colors: character.accent, startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
        .shadow(color: .black.opacity(0.4), radius: 18, x: 0, y: 16)
    }
}

private struct DiscoverCollectionCard: View {
    let collection: DiscoverCollection
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 16) {
            Circle()
                .fill(Color.white.opacity(0.15))
                .frame(width: 54, height: 54)
                .overlay(Image(systemName: collection.icon).foregroundStyle(Color.white))

            VStack(alignment: .leading, spacing: 4) {
                Text(collection.title)
                    .font(.headline)
                    .foregroundStyle(Color.white)
                Text(collection.detail)
                    .font(.subheadline)
                    .foregroundStyle(Color.white.opacity(0.7))
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(.white.opacity(0.6))
        }
        .padding()
        .background(
            LinearGradient(colors: collection.gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                .opacity(0.8)
        )
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28)
                .stroke(colorScheme == .dark ? Color.white.opacity(0.2) : Color.white.opacity(0.4), lineWidth: 1)
        )
    }
}

private struct ProfileView: View {
    let details: ProfileDetails
    let plan: ProfilePlan
    let stats: [ProfileStat]
    let activities: [ProfileActivity]
    @Binding var themeMode: String
    let isAuthenticated: Bool
    let onLoginTap: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var authStore: AuthStore

    var body: some View {
        NavigationStack {
            if !isAuthenticated {
                AuthRequiredView(
                    title: "登录以管理账号",
                    message: "查看会员计划、令牌余额与安全设置需要先登录 Supabase 账号。",
                    onLoginTap: onLoginTap
                )
                .padding(32)
                .background(
                    appBackgroundGradient(for: colorScheme)
                        .ignoresSafeArea()
                )
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 24) {
                        ProfileHeader(details: details)
                            .padding(.horizontal)

                        PlanOverviewCard(plan: plan)
                            .padding(.horizontal)

                        ProfileStatsGrid(stats: stats)
                            .padding(.horizontal)

                        TokenTipsCard()
                            .padding(.horizontal)

                        ProfileSettingsCard()
                            .padding(.horizontal)

                        PaymentInfoCard()
                            .padding(.horizontal)

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recent Activity")
                                .font(.title3.bold())
                                .foregroundStyle(primaryTextColor(for: colorScheme))
                            if activities.isEmpty {
                                Text("暂无记录，去和角色聊聊吧。")
                                    .font(.subheadline)
                                    .foregroundStyle(secondaryTextColor(for: colorScheme))
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding()
                                    .background(cardBackgroundColor(for: colorScheme, intensity: 0.04), in: RoundedRectangle(cornerRadius: 24))
                            } else {
                                VStack(spacing: 12) {
                                    ForEach(activities) { activity in
                                        ProfileActivityRow(activity: activity)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal)

                        AccountActionsCard()
                            .padding(.horizontal)

                        ThemeSelector(themeMode: $themeMode)
                            .padding(.horizontal)

                        Button(action: { authStore.logout() }) {
                            Label("退出登录", systemImage: "rectangle.portrait.and.arrow.forward")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 24))
                                .foregroundStyle(.red)
                        }
                        .padding(.horizontal)
                    }
                    .padding(.vertical, 28)
                }
                .background(
                    appBackgroundGradient(for: colorScheme)
                        .ignoresSafeArea()
                )
                .toolbar(.hidden, for: .navigationBar)
            }
        }
    }
}

private struct ProfileHeader: View {
    let details: ProfileDetails
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Profile", systemImage: "person.crop.circle")
                        .font(.title3.bold())
                        .labelStyle(.titleAndIcon)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text("管理个人资料、Token 与安全设置")
                        .font(.footnote)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                Spacer()
                HStack(spacing: 12) {
                    Button(action: {}) {
                        Image(systemName: "gearshape.fill")
                            .foregroundStyle(primaryTextColor(for: colorScheme))
                            .padding(10)
                            .background(cardBackgroundColor(for: colorScheme, intensity: 0.15), in: Circle())
                    }
                    Button(action: {}) {
                        Image(systemName: "arrow.right.square")
                            .foregroundStyle(.red)
                            .padding(10)
                            .background(Color.red.opacity(0.15), in: Circle())
                    }
                }
            }

            HStack(spacing: 16) {
                Circle()
                    .fill(LinearGradient(colors: [Color.pink, Color.purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 86, height: 86)
                    .overlay(Image(systemName: details.avatar).font(.system(size: 36)).foregroundStyle(.white))
                    .overlay(alignment: .bottomTrailing) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 22, height: 22)
                            .overlay(Circle().stroke(Color.black, lineWidth: 3))
                    }

                VStack(alignment: .leading, spacing: 6) {
                    Text(details.name)
                        .font(.title3.bold())
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text(details.email)
                        .font(.footnote)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                    Text(details.bio)
                        .font(.footnote)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                    HStack(spacing: 12) {
                        Label(details.status, systemImage: "bolt.horizontal.fill")
                            .font(.caption.bold())
                            .padding(.vertical, 4)
                            .padding(.horizontal, 8)
                            .background(Color.green.opacity(0.2), in: Capsule())
                        Label("加入于 \(details.joinedDate)", systemImage: "calendar")
                            .font(.caption)
                            .foregroundStyle(tertiaryTextColor(for: colorScheme))
                    }
                }
            }
        }
        .padding(24)
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 32))
    }
}

private struct PlanOverviewCard: View {
    let plan: ProfilePlan
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(plan.tier)
                        .font(.title3.bold())
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text("续订日 \(plan.renewalDate)")
                        .font(.caption)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                Spacer()
                Button(action: {}) {
                    Text("升级套餐")
                        .font(.subheadline.bold())
                        .padding(.vertical, 8)
                        .padding(.horizontal, 16)
                        .background(
                            LinearGradient(colors: [Color(red: 1.0, green: 0.58, blue: 0.82), Color(red: 1.0, green: 0.3, blue: 0.54)], startPoint: .leading, endPoint: .trailing)
                        , in: Capsule())
                        .foregroundColor(.white)
                }
            }

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(plan.tokensRemaining.formatted())
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                Text("tokens 剩余")
                    .font(.headline)
                    .foregroundStyle(secondaryTextColor(for: colorScheme))
                Spacer()
                Button(action: {}) {
                    Label("充值", systemImage: "bolt.fill")
                        .font(.subheadline.bold())
                        .padding(.vertical, 8)
                        .padding(.horizontal, 16)
                        .background(
                            LinearGradient(colors: [Color(red: 0.97, green: 0.5, blue: 0.65), Color(red: 0.84, green: 0.33, blue: 0.95)], startPoint: .leading, endPoint: .trailing)
                        , in: Capsule())
                        .foregroundColor(.white)
                }
            }

            Divider().background(cardBorderColor(for: colorScheme))

            HStack {
                ForEach(plan.benefits, id: \.self) { benefit in
                    Label(benefit, systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                        .padding(6)
                        .background(cardBackgroundColor(for: colorScheme, intensity: 0.12), in: Capsule())
                }
            }
        }
        .padding()
        .background(
            LinearGradient(colors: colorScheme == .dark ? [Color(red: 0.26, green: 0.18, blue: 0.4), Color(red: 0.66, green: 0.24, blue: 0.52)] : [Color(red: 0.85, green: 0.8, blue: 0.95), Color(red: 0.97, green: 0.9, blue: 0.95)] , startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 28))
    }
}

private struct TokenTipsCard: View {
    let tips = [
        ("💡", "长对话会自动用批处理模式节省 tokens"),
        ("🎯", "批量购买可额外赠送 10%"),
        ("⚡", "tokens 永不过期，随用随充")
    ]
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Token Insights")
                .font(.headline)
                .foregroundStyle(primaryTextColor(for: colorScheme))
            ForEach(tips, id: \.0) { tip in
                HStack(alignment: .top, spacing: 8) {
                    Text(tip.0)
                    Text(tip.1)
                        .font(.subheadline)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                .padding(8)
                .background(cardBackgroundColor(for: colorScheme, intensity: 0.05), in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme, intensity: 0.03), in: RoundedRectangle(cornerRadius: 24))
    }
}

private struct CharacterCreationFlow: View {
    @Binding var isPresented: Bool
    var allowsDismiss: Bool = true
    var onCreated: (ChatProfile) -> Void
    @Environment(\.colorScheme) private var colorScheme
    @State private var step: Int = 0
    @State private var name = ""
    @State private var shortDescription = ""
    @State private var backstory = ""
    @State private var personaPrompt = ""
    @State private var gender = "female"
    @State private var age: Int = 22
    @State private var conversationStyle = "沉浸式角色扮演"
    @State private var voiceStyle = "温柔而坚定"
    @State private var avatarPrompt = ""
    @State private var avatarStyle = "写实"
    @State private var avatarURL = ""
    @State private var generatedAvatarURL: String?
    @State private var isGeneratingAvatar = false
    @State private var customTrait = ""
    @State private var traits: [String] = []
    @State private var selectedCategories: Set<String> = []
    @State private var isPublic = true
    @State private var nsfwLevel: Int = 0
    @State private var isSubmitting = false
    @State private var submitError: String?
    private let categoryOptions = ["动漫","游戏","影视","书籍","真人","生活","家庭","校园","未来","奇幻"]
    private let avatarStyles = ["写实","赛博朋克","国风","插画","动漫"]
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var pickedImage: UIImage?
    @State private var isUploadingAvatar = false

    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 24) {
                        StepIndicator(current: step)

                        Group {
                            switch step {
                            case 0: basicsSection
                            case 1: avatarSection
                            case 2: traitsSection
                            default: settingsSection
                            }
                        }
                        .animation(.easeInOut, value: step)

                        if let submitError {
                            Text(submitError)
                                .foregroundStyle(.red)
                                .font(.footnote)
                        }

                        HStack {
                            if step > 0 {
                                Button("上一步") {
                                    withAnimation { step -= 1 }
                                }
                                .buttonStyle(.bordered)
                            }
                            Spacer()
                            Button(step == 3 ? "创建角色" : "下一步") {
                                if step == 3 {
                                    submit()
                                } else {
                                    withAnimation { step += 1 }
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.96, green: 0.45, blue: 0.71))
                            .disabled(!canProceed)
                        }
                    }
                    .padding()
                    .padding(.bottom, 120)
                }

                if isSubmitting {
                    Color.black.opacity(0.35)
                        .ignoresSafeArea()
                    ProgressView("创建角色中…")
                        .padding()
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
                }
            }
            .navigationTitle("创建角色")
            .toolbar {
                if allowsDismiss {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("关闭") { isPresented = false }
                    }
                }
            }
        }
        .interactiveDismissDisabled(allowsDismiss && isSubmitting)
    }

    private var basicsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("基本信息")
                .font(.title2.bold())
            VStack(alignment: .leading) {
                Text("角色名称")
                    .font(.headline)
                TextField("至少 2 个字符", text: $name)
                    .textFieldStyle(.roundedBorder)
            }
            Picker("性别", selection: $gender) {
                Text("女性").tag("female")
                Text("男性").tag("male")
                Text("其它").tag("other")
            }
            .pickerStyle(.segmented)

            Stepper(value: $age, in: 16...80) {
                Text("设定年龄：\(age) 岁")
            }

            VStack(alignment: .leading) {
                Text("角色简介")
                    .font(.headline)
                TextField("展示在角色卡片上的简介", text: $shortDescription)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("角色描述")
                    .font(.headline)
                TextEditor(text: $backstory)
                    .frame(height: 140)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.2)))
                Text("描述性格、背景、动机，至少 20 字。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("角色人格提示（LLM）")
                    .font(.headline)
                TextEditor(text: $personaPrompt)
                    .frame(height: 140)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.2)))
                Text("描述 AI 扮演该角色的语气与行为，例如对用户的态度、说话习惯。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var avatarSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("角色头像")
                .font(.title2.bold())

            if let previewImage = pickedImage {
                Image(uiImage: previewImage)
                    .resizable()
                    .scaledToFit()
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 28))
            } else if let previewURL = generatedAvatarURL.flatMap({ URL(string: $0) }) ?? (avatarURL.isEmpty ? nil : URL(string: avatarURL)) {
                AsyncImage(url: previewURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                    case .empty:
                        ProgressView()
                    case .failure:
                        Color.gray.opacity(0.2)
                    @unknown default:
                        Color.gray.opacity(0.2)
                    }
                }
                .frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 28))
            } else {
                RoundedRectangle(cornerRadius: 28)
                    .fill(Color.gray.opacity(0.12))
                    .frame(height: 180)
                    .overlay(Text("暂无头像").foregroundStyle(.secondary))
            }

            VStack(alignment: .leading) {
                Text("AI 头像描述")
                    .font(.headline)
                TextField("描述外貌、服装、情绪等特征", text: $avatarPrompt)
                    .textFieldStyle(.roundedBorder)
                Picker("艺术风格", selection: $avatarStyle) {
                    ForEach(avatarStyles, id: \.self) { Text($0) }
                }
                .pickerStyle(.segmented)
                Button(action: generateAvatar) {
                    if isGeneratingAvatar {
                        ProgressView()
                    } else {
                        Label("生成头像", systemImage: "sparkles")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.96, green: 0.45, blue: 0.71))
                .disabled(avatarPrompt.trimmingCharacters(in: .whitespaces).isEmpty || name.count < 2 || isGeneratingAvatar)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("上传自己的头像")
                    .font(.headline)
                PhotosPicker(selection: $selectedPhotoItem, matching: .images, photoLibrary: .shared()) {
                    Label(pickedImage == nil ? "选择照片" : "重新选择", systemImage: "photo")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(cardBackgroundColor(for: colorScheme, intensity: 0.08), in: RoundedRectangle(cornerRadius: 18))
                }
                .onChange(of: selectedPhotoItem) { newItem in
                    guard let newItem else { return }
                    Task {
                        if let data = try? await newItem.loadTransferable(type: Data.self),
                           let image = UIImage(data: data)?.normalizedImage() {
                            await MainActor.run {
                                self.pickedImage = image
                                self.generatedAvatarURL = nil
                                self.avatarURL = ""
                            }
                        }
                    }
                }
                Button("上传头像") {
                    uploadAvatar()
                }
                .buttonStyle(.borderedProminent)
                .disabled(pickedImage == nil || isUploadingAvatar)
                if isUploadingAvatar {
                    ProgressView("上传中…")
                        .font(.caption)
                }
            }

            VStack(alignment: .leading) {
                Text("或粘贴已有图片链接")
                    .font(.headline)
                TextField("https://...", text: $avatarURL)
                    .textFieldStyle(.roundedBorder)
            }
        }
    }

    private var traitsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("角色特征与分类")
                .font(.title2.bold())

            VStack(alignment: .leading) {
                Text("添加角色特质")
                    .font(.headline)
                HStack {
                    TextField("例如：友好、神秘、自信…", text: $customTrait)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit(addTrait)
                    Button(action: addTrait) {
                        Image(systemName: "plus")
                    }
                }
                if traits.isEmpty {
                    Text("建议添加 3-5 个特质，帮助系统了解角色。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    TagWrapLayout(spacing: 8) {
                        ForEach(traits, id: \.self) { trait in
                            HStack(spacing: 4) {
                                Text(trait)
                                Button(action: { traits.removeAll { $0 == trait } }) {
                                    Image(systemName: "xmark.circle.fill")
                                }
                            }
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(cardBackgroundColor(for: colorScheme, intensity: 0.12), in: Capsule())
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("选择角色分类 (最多 5 个)")
                    .font(.headline)
                TagWrapLayout(spacing: 8) {
                    ForEach(categoryOptions, id: \.self) { option in
                        Button(action: { toggleCategory(option) }) {
                            Text(option)
                                .font(.caption)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(selectedCategories.contains(option) ? Color(red: 0.96, green: 0.45, blue: 0.71) : cardBackgroundColor(for: colorScheme, intensity: 0.1), in: Capsule())
                                .foregroundStyle(selectedCategories.contains(option) ? Color.white : primaryTextColor(for: colorScheme))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("角色设置")
                .font(.title2.bold())

            Toggle("公开角色，允许被发现", isOn: $isPublic)
                .toggleStyle(SwitchToggleStyle(tint: Color(red: 0.96, green: 0.45, blue: 0.71)))

            Picker("成人内容", selection: $nsfwLevel) {
                Text("SAFE — 家庭友好").tag(0)
                Text("NSFW — 成人内容").tag(1)
            }
            .pickerStyle(.segmented)

            VStack(alignment: .leading, spacing: 8) {
                Text("对话语气")
                    .font(.headline)
                TextField("如：温柔且富有引导感", text: $conversationStyle)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("声线描述")
                    .font(.headline)
                TextField("如：低沉轻柔，像深夜 DJ", text: $voiceStyle)
                    .textFieldStyle(.roundedBorder)
            }

            summaryCard
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("预览")
                .font(.headline)
            Text("名称：\(name.isEmpty ? "未命名" : name)")
            Text("分类：\((Array(selectedCategories).prefix(5).isEmpty ? ["未分类"] : Array(selectedCategories).prefix(5)).joined(separator: " · "))")
            Text("特质：\(traits.isEmpty ? "默认" : traits.joined(separator: " · "))")
            Text("内容分级：\(nsfwLevel == 0 ? "SAFE" : "成人")")
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme, intensity: 0.05), in: RoundedRectangle(cornerRadius: 20))
    }

    private var canProceed: Bool {
        switch step {
        case 0:
            return name.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 && shortDescription.trimmingCharacters(in: .whitespacesAndNewlines).count >= 4 && backstory.count >= 20 && personaPrompt.count >= 20
        case 1:
            return (generatedAvatarURL != nil || !avatarURL.isEmpty)
        case 2:
            return !traits.isEmpty || !selectedCategories.isEmpty
        default:
            return true
        }
    }

    private func addTrait() {
        let trimmed = customTrait.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if !traits.contains(trimmed) && traits.count < 8 {
            traits.append(trimmed)
        }
        customTrait = ""
    }

    private func toggleCategory(_ option: String) {
        if selectedCategories.contains(option) {
            selectedCategories.remove(option)
        } else if selectedCategories.count < 5 {
            selectedCategories.insert(option)
        }
    }

    private func generateAvatar() {
        guard !avatarPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        isGeneratingAvatar = true
        submitError = nil
        let characterName = name.isEmpty ? "新角色" : name
        Task {
            do {
                let url = try await APIClient.generateAvatar(prompt: avatarPrompt, name: characterName, gender: gender, style: avatarStyle)
                await MainActor.run {
                    generatedAvatarURL = url
                    isGeneratingAvatar = false
                }
            } catch {
                await MainActor.run {
                    isGeneratingAvatar = false
                    submitError = error.localizedDescription
                }
            }
        }
    }

    private func uploadAvatar() {
        guard let image = pickedImage, let data = image.jpegData(compressionQuality: 0.85) else {
            submitError = "请先选择一张照片"
            return
        }
        isUploadingAvatar = true
        submitError = nil
        Task {
            do {
                let url = try await APIClient.uploadAvatar(data: data, mimeType: "image/jpeg", filename: "avatar-\(UUID().uuidString).jpg")
                await MainActor.run {
                    generatedAvatarURL = url
                    avatarURL = url
                    isUploadingAvatar = false
                }
            } catch {
                await MainActor.run {
                    isUploadingAvatar = false
                    submitError = error.localizedDescription
                }
            }
        }
    }

    private func submit() {
        guard !isSubmitting else { return }
        isSubmitting = true
        submitError = nil
        let payload = CharacterCreationPayload(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            description: shortDescription.trimmingCharacters(in: .whitespacesAndNewlines),
            avatarURL: (generatedAvatarURL ?? (avatarURL.isEmpty ? nil : avatarURL)),
            backstory: backstory,
            personaPrompt: personaPrompt,
            voiceStyle: voiceStyle,
            traits: traits.isEmpty ? ["陪伴"] : traits,
            category: selectedCategories.first ?? "原创",
            categories: selectedCategories.isEmpty ? ["原创"] : Array(selectedCategories.prefix(5)),
            gender: gender,
            nsfwLevel: nsfwLevel,
            age: age,
            conversationStyle: conversationStyle,
            isPublic: isPublic
        )

        Task {
            do {
                let dto = try await APIClient.createCharacter(payload: payload)
                let finalAvatar = generatedAvatarURL ?? (avatarURL.isEmpty ? nil : avatarURL)
                let createdProfile = buildProfile(from: dto, avatarURL: finalAvatar)
                await MainActor.run {
                    isSubmitting = false
                    onCreated(createdProfile)
                    if allowsDismiss {
                        isPresented = false
                    } else {
                        resetForm()
                    }
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    submitError = error.localizedDescription
                }
            }
        }
    }

    private func buildProfile(from dto: CharacterDTO, avatarURL: String?) -> ChatProfile {
        let gradients = [
            [Color(red: 0.91, green: 0.32, blue: 0.63), Color(red: 0.67, green: 0.37, blue: 0.99)],
            [Color(red: 0.18, green: 0.69, blue: 0.61), Color(red: 0.07, green: 0.35, blue: 0.42)],
            [Color(red: 0.98, green: 0.64, blue: 0.27), Color(red: 0.69, green: 0.32, blue: 0.15)],
            [Color(red: 0.36, green: 0.21, blue: 0.55), Color(red: 0.72, green: 0.32, blue: 0.85)]
        ]
        let gradient = gradients[Int.random(in: 0..<gradients.count)]
        let traitList = traits.isEmpty ? ["陪伴"] : traits
        return ChatProfile(
            characterId: dto.id,
            name: dto.name,
            tagline: shortDescription.isEmpty ? dto.description ?? "新角色" : shortDescription,
            description: backstory,
            traits: traitList,
            rating: 4.8,
            likes: 0,
            chats: 0,
            views: 0,
            badge: .newEntry,
            heroIcon: "sparkles",
            colorStops: gradient,
            imageURL: avatarURL.flatMap { URL(string: $0) }
        )
    }

    private func resetForm() {
        step = 0
        name = ""
        shortDescription = ""
        backstory = ""
        personaPrompt = ""
        gender = "female"
        age = 22
        conversationStyle = "沉浸式角色扮演"
        voiceStyle = "温柔而坚定"
        avatarPrompt = ""
        avatarStyle = "写实"
        avatarURL = ""
        generatedAvatarURL = nil
        selectedPhotoItem = nil
        pickedImage = nil
        isGeneratingAvatar = false
        customTrait = ""
        traits = []
        selectedCategories = []
        isPublic = true
        nsfwLevel = 0
        submitError = nil
    }
}

private struct StepIndicator: View {
    let current: Int
    private let titles = ["1", "2", "3", "4"]

    var body: some View {
        HStack {
            ForEach(titles.indices, id: \.self) { index in
                VStack(spacing: 4) {
                    Circle()
                        .fill(index <= current ? Color(red: 0.96, green: 0.45, blue: 0.71) : Color.gray.opacity(0.3))
                        .frame(width: 20, height: 20)
                        .overlay(
                            Text(titles[index])
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                        )
                }
                if index < titles.count - 1 {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(height: 1)
                }
            }
        }
        .padding(.horizontal)
    }
}

struct TagWrapLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? UIScreen.main.bounds.width - 48
        var width: CGFloat = 0
        var height: CGFloat = 0
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if width + size.width > maxWidth {
                width = 0
                height += rowHeight + spacing
                rowHeight = 0
            }
            width += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        height += rowHeight
        return CGSize(width: maxWidth, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var origin = CGPoint(x: bounds.minX, y: bounds.minY)
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if origin.x + size.width > bounds.minX + maxWidth {
                origin.x = bounds.minX
                origin.y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: origin, proposal: ProposedViewSize(width: size.width, height: size.height))
            origin.x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

private struct ProfileSettingsCard: View {
    @State private var lowBalanceAlert = true
    @State private var autoPurchase = false
    @State private var usageAnalytics = true
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Preferences")
                .font(.title3.bold())
                .foregroundStyle(primaryTextColor(for: colorScheme))

            SettingsToggleRow(title: "低余额提醒", subtitle: "tokens 低于 500 时推送通知", isOn: $lowBalanceAlert)
            SettingsToggleRow(title: "自动充值", subtitle: "余额不足时自动购买 500 tokens", isOn: $autoPurchase)
            SettingsToggleRow(title: "使用分析", subtitle: "记录详细使用数据方便汇报", isOn: $usageAnalytics)
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 24))
    }
}

private struct SettingsToggleRow: View {
    let title: String
    let subtitle: String
    @Binding var isOn: Bool
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(tertiaryTextColor(for: colorScheme))
            }
            Spacer()
            Toggle("", isOn: $isOn)
                .labelsHidden()
        }
    }
}

private struct PaymentInfoCard: View {
    @Environment(\.colorScheme) private var colorScheme
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Payment Settings")
                .font(.title3.bold())
                .foregroundStyle(primaryTextColor(for: colorScheme))

            VStack(spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("默认支付方式")
                            .font(.headline)
                            .foregroundStyle(primaryTextColor(for: colorScheme))
                        Text("•••• 7788 · Visa")
                            .font(.caption)
                            .foregroundStyle(secondaryTextColor(for: colorScheme))
                    }
                    Spacer()
                    Button(action: {}) {
                        Text("管理")
                            .font(.subheadline)
                            .padding(.vertical, 6)
                            .padding(.horizontal, 14)
                            .background(cardBackgroundColor(for: colorScheme, intensity: 0.1), in: Capsule())
                    }
                }
                Divider().background(cardBorderColor(for: colorScheme))
                VStack(alignment: .leading, spacing: 4) {
                    Text("常用套餐")
                        .font(.headline)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text("标准包 · 500 tokens")
                        .font(.caption)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                Divider().background(cardBorderColor(for: colorScheme))
                Button(action: {}) {
                    Label("导出账单", systemImage: "square.and.arrow.up")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(cardBackgroundColor(for: colorScheme, intensity: 0.08), in: RoundedRectangle(cornerRadius: 18))
                }
            }
            .padding()
            .background(cardBackgroundColor(for: colorScheme, intensity: 0.03), in: RoundedRectangle(cornerRadius: 24))
        }
    }
}

extension UIImage {
    func normalizedImage() -> UIImage {
        if imageOrientation == .up { return self }
        UIGraphicsBeginImageContextWithOptions(size, false, scale)
        draw(in: CGRect(origin: .zero, size: size))
        let normalized = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return normalized ?? self
    }
}

private struct CharacterCreationScreen: View {
    let onCreated: (ChatProfile) -> Void
    let onRequireLogin: () -> Void
    let onChatCreated: (ChatPreview) -> Void
    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var chatStore: ChatStore
    @State private var createdProfile: ChatProfile?

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                CharacterCreationFlow(isPresented: .constant(true), allowsDismiss: false) { profile in
                    createdProfile = profile
                    onCreated(profile)
                }
            } else {
                AuthRequiredView(
                    title: "登录后创建角色",
                    message: "需要先登录 Supabase 账号才能上架自己的 AI 角色。",
                    onLoginTap: onRequireLogin
                )
                .padding(32)
            }
        }
        .sheet(item: $createdProfile) { profile in
            ProfileDetailSheet(
                profile: profile,
                onRequireLogin: onRequireLogin,
                authStore: authStore,
                chatStore: chatStore,
                onChatCreated: onChatCreated
            )
        }
    }
}

private struct AccountActionsCard: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Account")
                .font(.title3.bold())
                .foregroundStyle(primaryTextColor(for: colorScheme))

            VStack(spacing: 16) {
                AccountActionRow(title: "Creator Program", subtitle: "提交角色与收益结算", icon: "wand.and.stars")
                AccountActionRow(title: "Security", subtitle: "登录设备与密码", icon: "lock.shield")
                AccountActionRow(title: "Logout", subtitle: "退出当前账号", icon: "arrow.right.square", isDestructive: true)
            }
        }
    }
}

private struct AccountActionRow: View {
    let title: String
    let subtitle: String
    let icon: String
    var isDestructive: Bool = false
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(isDestructive ? Color.red : primaryTextColor(for: colorScheme))
                .frame(width: 44, height: 44)
                .background((isDestructive ? Color.red.opacity(0.15) : cardBackgroundColor(for: colorScheme, intensity: 0.08)), in: RoundedRectangle(cornerRadius: 16))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(isDestructive ? Color.red : primaryTextColor(for: colorScheme))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(secondaryTextColor(for: colorScheme))
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(secondaryTextColor(for: colorScheme))
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 24))
    }
}

private struct ThemeSelector: View {
    @Binding var themeMode: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("主题")
                .font(.title3.bold())
                .foregroundStyle(primaryTextColor(for: colorScheme))

            Picker("Theme", selection: $themeMode) {
                ForEach(ThemeMode.allCases) { mode in
                    Text(mode.rawValue).tag(mode.rawValue)
                }
            }
            .pickerStyle(.segmented)
            .background(cardBackgroundColor(for: colorScheme, intensity: 0.08), in: RoundedRectangle(cornerRadius: 16))
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 24))
    }
}

private struct ProfileStatsGrid: View {
    let stats: [ProfileStat]
    @Environment(\.colorScheme) private var colorScheme

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 16) {
            ForEach(stats) { stat in
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Image(systemName: stat.icon); Spacer(); }
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                    Text(stat.value)
                        .font(.title.bold())
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text(stat.label)
                        .font(.headline)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text(stat.description)
                        .font(.caption)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                .padding()
                .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 24))
            }
        }
    }
}

private struct ProfileActivityRow: View {
    let activity: ProfileActivity
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(cardBackgroundColor(for: colorScheme, intensity: 0.08))
                .frame(width: 48, height: 48)
                .overlay(Image(systemName: activity.icon).foregroundStyle(.white))

            VStack(alignment: .leading, spacing: 4) {
                Text("与 \(activity.character) 的对话")
                    .font(.headline)
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                Text(activity.summary)
                    .font(.subheadline)
                    .foregroundStyle(secondaryTextColor(for: colorScheme))
                Text(activity.ago)
                    .font(.caption)
                    .foregroundStyle(tertiaryTextColor(for: colorScheme))
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(secondaryTextColor(for: colorScheme))
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme, intensity: 0.03), in: RoundedRectangle(cornerRadius: 24))
    }
}

private struct ProfileCard: View {
    let profile: ChatProfile
    var onTap: () -> Void = {}
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)

        HStack(spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                LinearGradient(colors: profile.colorStops, startPoint: .top, endPoint: .bottom)
                if let url = profile.imageURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: 150, height: 160)
                                .clipped()
                                .alignmentGuide(.top) { _ in -40 }
                        case .failure:
                            Image(systemName: profile.heroIcon)
                                .resizable()
                                .scaledToFit()
                                .padding(20)
                                .foregroundColor(.white.opacity(0.9))
                        case .empty:
                            ProgressView()
                        @unknown default:
                            Image(systemName: profile.heroIcon)
                                .resizable()
                                .scaledToFit()
                                .padding(20)
                                .foregroundColor(.white.opacity(0.9))
                        }
                    }
                } else {
                    Image(systemName: profile.heroIcon)
                        .resizable()
                        .scaledToFit()
                        .padding(20)
                        .foregroundColor(.white.opacity(0.9))
                }
                LinearGradient(colors: [.black.opacity(0.4), .clear], startPoint: .bottom, endPoint: .top)
                Text(profile.badge.label)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.2), in: Capsule())
                    .padding(8)
            }
            .frame(width: 150, height: 160)
            .clipped()

            VStack(alignment: .leading, spacing: 6) {
                Text(profile.name)
                    .font(.headline)
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                    .lineLimit(1)
                Text(profile.tagline)
                    .font(.footnote)
                    .foregroundStyle(secondaryTextColor(for: colorScheme))
                    .lineLimit(1)
                Text(profile.description)
                    .font(.caption)
                    .foregroundStyle(tertiaryTextColor(for: colorScheme))
                    .lineLimit(2)

                Spacer()

                HStack(spacing: 12) {
                    Label(String(format: "%.1f", profile.rating), systemImage: "star.fill")
                    Label("\(profile.likes)", systemImage: "heart.fill")
                }
                .font(.caption2)
                .foregroundStyle(secondaryTextColor(for: colorScheme))
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 160, alignment: .leading)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 160)
        .background(shape.fill(cardBackgroundColor(for: colorScheme)))
        .overlay(shape.stroke(cardBorderColor(for: colorScheme), lineWidth: 1))
        .clipShape(shape)
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 12)
        .contentShape(shape)
        .onTapGesture { onTap() }
    }
}

private struct ProfileDetailSheet: View {
    let profile: ChatProfile
    let onRequireLogin: () -> Void
    @ObservedObject var authStore: AuthStore
    @ObservedObject var chatStore: ChatStore
    let onChatCreated: (ChatPreview) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var isCreatingChat = false
    @State private var creationError: String?

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 28) {
                    heroSection
                    detailSection
                }
                .padding(.top, -20)
                .padding(.bottom, 24)
            }
            .background(appBackgroundGradient(for: colorScheme).ignoresSafeArea())
        }
    }

    private var heroSection: some View {
        let shape = RoundedRectangle(cornerRadius: 36, style: .continuous)
        return ZStack(alignment: .topLeading) {
            heroImage(for: profile)
                .frame(maxWidth: .infinity, minHeight: 420, maxHeight: 460)
                .clipped()
                .clipShape(shape)
                .overlay(
                    LinearGradient(colors: [.black.opacity(0.5), .clear, .clear], startPoint: .top, endPoint: .bottom)
                        .clipShape(shape)
                )
                .background(
                    LinearGradient(colors: profile.colorStops, startPoint: .topLeading, endPoint: .bottomTrailing)
                        .clipShape(shape)
                )
                .shadow(color: .black.opacity(0.3), radius: 30, x: 0, y: 20)
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .ignoresSafeArea(edges: .top)

            Button(action: { dismiss() }) {
                Image(systemName: "chevron.left")
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                    .padding(10)
                    .background(Color.black.opacity(0.35), in: Circle())
            }
            .padding(.top, 44)
            .padding(.leading, 32)
        }
        .padding(.horizontal, 16)
    }

    private var detailSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 12) {
                Text(profile.name)
                    .font(.largeTitle.bold())
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                Text(profile.tagline)
                    .font(.headline)
                    .foregroundStyle(secondaryTextColor(for: colorScheme))
                Text(profile.description)
                    .font(.body)
                    .foregroundStyle(secondaryTextColor(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("角色特质")
                    .font(.headline)
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                FlexibleTraitView(traits: profile.traits)
            }

            VStack(spacing: 12) {
                Button(action: startChat) {
                    HStack {
                        if isCreatingChat {
                            ProgressView().tint(.white)
                        } else {
                            Text("开始聊天")
                                .font(.headline)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        LinearGradient(colors: [Color(red: 0.96, green: 0.45, blue: 0.71), Color(red: 0.67, green: 0.4, blue: 0.93)], startPoint: .leading, endPoint: .trailing)
                        , in: Capsule())
                    .foregroundColor(.white)
                }
                .disabled(isCreatingChat)
                HStack(spacing: 12) {
                    StatPill(title: "评分", value: String(format: "%.1f", profile.rating), icon: "star.fill")
                    StatPill(title: "点赞", value: profile.likes.formatted(), icon: "heart.fill")
                    StatPill(title: "会话", value: profile.chats.formatted(), icon: "message.fill")
                    StatPill(title: "浏览", value: profile.views.formatted(), icon: "eye.fill")
                }
                if let creationError {
                    Text(creationError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
    }

    private var placeholderImage: some View {
        LinearGradient(colors: profile.colorStops, startPoint: .topLeading, endPoint: .bottomTrailing)
            .overlay(
                Image(systemName: profile.heroIcon)
                    .resizable()
                    .scaledToFit()
                    .padding(80)
                    .foregroundStyle(.white.opacity(0.8))
            )
    }

    @ViewBuilder
    private func heroImage(for profile: ChatProfile) -> some View {
        if let url = profile.imageURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    placeholderImage
                case .empty:
                    ProgressView()
                @unknown default:
                    placeholderImage
                }
            }
        } else {
            placeholderImage
        }
    }

    private func startChat() {
        guard authStore.isAuthenticated else {
            dismiss()
            onRequireLogin()
            return
        }
        guard profile.characterId != nil else {
            creationError = "该角色暂不支持创建对话"
            return
        }
        creationError = nil
        isCreatingChat = true
        Task {
            do {
                let preview = try await chatStore.createChat(for: profile)
                await MainActor.run {
                    isCreatingChat = false
                    onChatCreated(preview)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    creationError = error.localizedDescription
                    isCreatingChat = false
                }
            }
        }
    }
}

private struct StatPill: View {
    let title: String
    let value: String
    let icon: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(title, systemImage: icon)
                .font(.caption)
                .foregroundStyle(tertiaryTextColor(for: colorScheme))
            Text(value)
                .font(.headline)
                .foregroundStyle(primaryTextColor(for: colorScheme))
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 20))
    }
}

private struct FlexibleTraitView: View {
    let traits: [String]

    private let columns = [GridItem(.adaptive(minimum: 110), spacing: 8)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(traits, id: \.self) { trait in
                Text(trait)
                    .font(.caption.bold())
                    .padding(.vertical, 6)
                    .padding(.horizontal, 12)
                    .background(traitBackground, in: Capsule())
                    .overlay(
                        Capsule().stroke(traitBorder, lineWidth: 1)
                    )
                    .foregroundStyle(traitForeground)
            }
        }
    }

    @Environment(\.colorScheme) private var colorScheme

    private var traitBackground: Color {
        colorScheme == .dark
            ? Color.white.opacity(0.12)
            : Color.black.opacity(0.05)
    }

    private var traitBorder: Color {
        colorScheme == .dark
            ? Color.white.opacity(0.2)
            : Color.black.opacity(0.08)
    }

    private var traitForeground: Color {
        colorScheme == .dark
            ? Color.white
            : Color.black.opacity(0.8)
    }
}

private struct ChatsListView: View {
    let chatPreviews: [ChatPreview]
    let messageSeed: [ChatMessage]
    let isLoading: Bool
    let isUsingFallback: Bool
    let errorMessage: String?
    let isAuthenticated: Bool
    let onLoginTap: () -> Void
    @Binding var selectedPreview: ChatPreview?
    let onRefresh: () async -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        NavigationStack {
            if !isAuthenticated {
                AuthRequiredView(
                    title: "登录后查看最近聊天",
                    message: "与网页版同步会话记录、消息和收藏角色。",
                    onLoginTap: onLoginTap
                )
                .padding(32)
                .background(
                    appBackgroundGradient(for: colorScheme)
                        .ignoresSafeArea()
                )
            } else {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 24) {
                    header

                    if let errorMessage = errorMessage {
                        ErrorBanner(message: errorMessage)
                            .padding(.horizontal)
                    }

                    if chatPreviews.isEmpty {
                        EmptyChatPlaceholder(isLoading: isLoading)
                            .padding(.horizontal)
                    } else {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("正在聊天")
                                .font(.headline)
                                .foregroundStyle(secondaryTextColor(for: colorScheme))
                            ForEach(chatPreviews.prefix(1)) { preview in
                                ActiveChatCard(preview: preview) {
                                    selectedPreview = preview
                                }
                            }
                            if isLoading && isUsingFallback {
                                ProgressView()
                                    .tint(secondaryTextColor(for: colorScheme))
                            }
                        }
                        .allowsHitTesting(!isUsingFallback)
                        .padding(.horizontal)

                        VStack(alignment: .leading, spacing: 16) {
                            Text("Past chats")
                                .font(.headline)
                                .foregroundStyle(secondaryTextColor(for: colorScheme))
                            ForEach(chatPreviews.dropFirst(), id: \.id) { preview in
                                PastChatRow(preview: preview) {
                                    selectedPreview = preview
                                }
                            }
                        }
                        .allowsHitTesting(!isUsingFallback)
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical, 32)
            }
            .refreshable {
                await onRefresh()
            }
            .background(
                appBackgroundGradient(for: colorScheme)
                    .ignoresSafeArea()
            )
                .navigationDestination(item: $selectedPreview) { preview in
                    ChatView(preview: preview)
                        .onDisappear {
                            if selectedPreview?.id == preview.id {
                                selectedPreview = nil
                            }
                        }
                }
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text("Chats")
                    .font(.largeTitle.bold())
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                Text(isUsingFallback ? "展示的是本地示例，等待与服务器同步" : "与网页版保持实时同步")
                    .font(.footnote)
                    .foregroundStyle(tertiaryTextColor(for: colorScheme))
            }
            Spacer()
            Button {
                Task { await onRefresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.headline)
                    .padding(8)
                    .background(cardBackgroundColor(for: colorScheme, intensity: 0.08), in: Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal)
    }
}

private struct ErrorBanner: View {
    let message: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.yellow)
            Text(message)
                .font(.footnote)
                .foregroundStyle(primaryTextColor(for: colorScheme))
            Spacer()
        }
        .padding()
        .background(cardBackgroundColor(for: colorScheme, intensity: 0.12), in: RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(cardBorderColor(for: colorScheme), lineWidth: 1)
        )
    }
}

private struct EmptyChatPlaceholder: View {
    let isLoading: Bool
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 16) {
            if isLoading {
                ProgressView()
                    .tint(secondaryTextColor(for: colorScheme))
            }
            Text(isLoading ? "正在同步你的对话历史..." : "还没有任何聊天记录")
                .font(.subheadline)
                .foregroundStyle(secondaryTextColor(for: colorScheme))
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 24))
    }
}

private struct AuthRequiredView: View {
    let title: String
    let message: String
    let onLoginTap: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.fill")
                .font(.system(size: 48))
                .foregroundStyle(primaryTextColor(for: colorScheme))
            VStack(spacing: 8) {
                Text(title)
                    .font(.title2.bold())
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                Text(message)
                    .font(.body)
                    .foregroundStyle(secondaryTextColor(for: colorScheme))
                    .multilineTextAlignment(.center)
            }
            Button(action: onLoginTap) {
                Text("立即登录")
                    .font(.headline)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity)
                    .background(
                        LinearGradient(colors: [Color(red: 0.96, green: 0.45, blue: 0.71), Color(red: 0.67, green: 0.4, blue: 0.93)], startPoint: .leading, endPoint: .trailing)
                        , in: RoundedRectangle(cornerRadius: 24)
                    )
                    .foregroundStyle(.white)
            }
            .padding(.top, 8)
        }
        .padding(32)
        .background(cardBackgroundColor(for: colorScheme), in: RoundedRectangle(cornerRadius: 32))
    }
}

private struct ActiveChatCard: View {
    let preview: ChatPreview
    let onTap: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 16) {
                AvatarView(
                    symbolName: preview.avatar,
                    url: preview.avatarURL,
                    size: 64,
                    backgroundColor: cardBackgroundColor(for: colorScheme, intensity: 0.12)
                )

                VStack(alignment: .leading, spacing: 6) {
                    Text(preview.name)
                        .font(.headline)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text(preview.snippet)
                        .font(.subheadline)
                        .lineLimit(2)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                Spacer()
                Text(preview.timestamp)
                    .font(.caption)
                    .foregroundStyle(tertiaryTextColor(for: colorScheme))
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(cardBorderColor(for: colorScheme), lineWidth: 1)
                    .background(RoundedRectangle(cornerRadius: 24).fill(cardBackgroundColor(for: colorScheme)))
            )
        }
    }
}

private struct PastChatRow: View {
    let preview: ChatPreview
    let onTap: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                AvatarView(
                    symbolName: preview.avatar,
                    url: preview.avatarURL,
                    size: 48,
                    backgroundColor: cardBackgroundColor(for: colorScheme, intensity: 0.08)
                )

                VStack(alignment: .leading, spacing: 4) {
                    Text(preview.name)
                        .font(.headline)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text(preview.snippet)
                        .font(.footnote)
                        .lineLimit(1)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                Spacer()
                Text(preview.timestamp)
                    .font(.caption2)
                    .foregroundStyle(tertiaryTextColor(for: colorScheme))
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(cardBackgroundColor(for: colorScheme, intensity: 0.03))
                    .overlay(
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(cardBorderColor(for: colorScheme), lineWidth: 1)
                    )
            )
        }
    }
}

private struct AvatarView: View {
    let symbolName: String
    let url: URL?
    let size: CGFloat
    let backgroundColor: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(backgroundColor)
            avatarContent
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    @ViewBuilder
    private var avatarContent: some View {
        if let url = url {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                        .frame(width: size, height: size)
                        .clipShape(Circle())
                case .failure:
                    fallbackSymbol
                case .empty:
                    ProgressView()
                        .tint(.white)
                @unknown default:
                    fallbackSymbol
                }
            }
        } else {
            fallbackSymbol
        }
    }

    private var fallbackSymbol: some View {
        Image(systemName: symbolName)
            .font(symbolFont)
            .foregroundStyle(.white)
    }

    private var symbolFont: Font {
        if size >= 60 { return .title }
        if size >= 50 { return .title2 }
        return .title3
    }
}

private struct LoginView: View {
    @ObservedObject var authStore: AuthStore
    @State private var email = ""
    @State private var password = ""
    @State private var manualToken = ""
    @State private var showTokenBox = false
    @State private var showPassword = false
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && !authStore.isWorking
    }

    private var loginButtonBackground: AnyShapeStyle {
        if canSubmit {
            return AnyShapeStyle(
                LinearGradient(colors: [Color(red: 0.96, green: 0.45, blue: 0.71), Color(red: 0.67, green: 0.4, blue: 0.93)], startPoint: .leading, endPoint: .trailing)
            )
        }
        return AnyShapeStyle(Color.gray.opacity(0.3))
    }

    var body: some View {
        ZStack {
            loginBackground
                .ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 8) {
                        Text("欢迎回来")
                            .font(.largeTitle.bold())
                            .foregroundStyle(primaryTextColor)
                        Text("使用 YY Chat 账号同步网页端的会话与角色")
                            .font(.body)
                            .foregroundStyle(secondaryTextColor)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 24)

                    VStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("邮箱")
                                .font(.subheadline.bold())
                                .foregroundStyle(primaryTextColor)
                            HStack {
                                Image(systemName: "envelope")
                                    .foregroundStyle(secondaryTextColor)
                                TextField("you@example.com", text: $email)
                                    .textContentType(.emailAddress)
                                    .keyboardType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .disableAutocorrection(true)
                            }
                            .padding()
                            .background(fieldBackground, in: RoundedRectangle(cornerRadius: 20))
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("密码")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(primaryTextColor)
                                Spacer()
                                Button("忘记密码？") {
                                    Task { await authStore.sendPasswordReset(to: email) }
                                }
                                .font(.caption)
                                .foregroundStyle(Color(red: 0.96, green: 0.45, blue: 0.71))
                                .disabled(email.isEmpty || authStore.isWorking)
                            }
                            HStack {
                                Image(systemName: "lock")
                                    .foregroundStyle(secondaryTextColor)
                                Group {
                                    if showPassword {
                                        TextField("••••••", text: $password)
                                    } else {
                                        SecureField("••••••", text: $password)
                                    }
                                }
                                .textContentType(.password)
                                Button(action: { showPassword.toggle() }) {
                                    Image(systemName: showPassword ? "eye.slash" : "eye")
                                        .foregroundStyle(secondaryTextColor)
                                }
                            }
                            .padding()
                            .background(fieldBackground, in: RoundedRectangle(cornerRadius: 20))
                        }
                    }

                    Button(action: {
                        Task { await authStore.login(email: email, password: password) }
                    }) {
                        HStack {
                            if authStore.isWorking {
                                ProgressView().tint(.white)
                            } else {
                                Text("登录")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(loginButtonBackground, in: RoundedRectangle(cornerRadius: 24))
                        .foregroundStyle(.white)
                    }
                    .disabled(!canSubmit)

                    Button(action: {
                        authStore.loginWithGoogle()
                    }) {
                        HStack(spacing: 8) {
                            Image(systemName: "g.circle")
                            Text("使用 Google 登录")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(fieldBackground, in: RoundedRectangle(cornerRadius: 24))
                    }
                    .disabled(authStore.isWorking)

                    if let success = authStore.successMessage {
                        Text(success)
                            .font(.footnote)
                            .foregroundStyle(.green)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if let error = authStore.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    DisclosureGroup(isExpanded: $showTokenBox) {
                        VStack(spacing: 12) {
                            TextField("粘贴已有的访问 Token", text: $manualToken, axis: .vertical)
                                .lineLimit(2...4)
                                .textInputAutocapitalization(.never)
                                .disableAutocorrection(true)
                                .padding()
                                .background(fieldBackground, in: RoundedRectangle(cornerRadius: 18))
                            Button("直接使用 Access Token") {
                                let token = manualToken.trimmingCharacters(in: .whitespacesAndNewlines)
                                Task { await authStore.adoptExistingToken(token) }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(fieldBackground.opacity(0.8), in: RoundedRectangle(cornerRadius: 18))
                        }
                        .padding(.top, 12)
                    } label: {
                        HStack {
                            Text("已有访问令牌？")
                                .font(.subheadline)
                                .foregroundStyle(primaryTextColor)
                            Spacer()
                            Image(systemName: showTokenBox ? "chevron.up" : "chevron.down")
                                .foregroundStyle(secondaryTextColor)
                        }
                        .padding()
                        .background(fieldBackground.opacity(0.7), in: RoundedRectangle(cornerRadius: 20))
                    }

                    Button("没有账号？去网页版注册") {
                        if let url = URL(string: "https://hzlmslkdbnsqrooivaub.supabase.co/auth/v1/signup") {
                            openURL(url)
                        }
                    }
                    .font(.footnote)
                    .foregroundStyle(secondaryTextColor)

                    Text("本地调试阶段：Supabase URL 与密钥来源于 Info.plist，可随时切换测试或生产项目。")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(secondaryTextColor)
                        .padding(.bottom, 24)
                }
                .padding(.horizontal, 24)
            }
        }
    }

    private var isDarkMode: Bool { colorScheme == .dark }

    private var loginBackground: LinearGradient {
        if isDarkMode {
            return LinearGradient(colors: [Color(red: 0.08, green: 0.08, blue: 0.18), Color(red: 0.21, green: 0.05, blue: 0.32)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        return LinearGradient(colors: [Color(red: 0.95, green: 0.95, blue: 1.0), Color(red: 0.88, green: 0.9, blue: 1.0)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private var primaryTextColor: Color {
        isDarkMode ? .white : Color.black.opacity(0.85)
    }

    private var secondaryTextColor: Color {
        isDarkMode ? Color.white.opacity(0.8) : Color.black.opacity(0.6)
    }

    private var fieldBackground: Color {
        isDarkMode ? Color.white.opacity(0.12) : Color.white.opacity(0.9)
    }
}

private struct ChatView: View {
    @StateObject private var viewModel: ChatDetailViewModel
    @State private var draftText = ""
    @State private var activeActionMessageID: String?
    @State private var pagerIndex = 0
    @State private var selectedProfile: ChatProfile?
    @State private var notificationsMuted = false
    @State private var immersiveBackground = true
    @State private var quickRepliesEnabled = true
    @State private var showClearConfirmation = false
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var chatStore: ChatStore
    @EnvironmentObject private var characterStore: CharacterStore
    private let bottomAnchorID = "chat-bottom-anchor"

    init(preview: ChatPreview) {
        _viewModel = StateObject(wrappedValue: ChatDetailViewModel(preview: preview))
    }

    var body: some View {
        VStack(spacing: 0) {
            ChatHeader(
                preview: viewModel.preview,
                onAvatarTap: {
                    presentRoleSheet()
                    Task { await viewModel.loadCharacterState() }
                }
            )
            .padding(.horizontal)

            TabView(selection: $pagerIndex) {
                chatPage
                    .tag(0)
                CharacterStatePage(
                    metrics: viewModel.stateMetrics,
                    isLoading: viewModel.isLoadingState,
                    errorMessage: viewModel.stateErrorMessage,
                    updatedText: viewModel.stateUpdatedText,
                    onRefresh: { Task { await viewModel.loadCharacterState(force: true) } }
                )
                .tag(1)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            hintStrip

            ChatInputBar(text: $draftText, isBusy: viewModel.isSending || viewModel.isGenerating) {
                sendCurrentMessage()
            }
            .padding(.horizontal)
            .padding(.vertical, 12)
        }
        .background(
            appBackgroundGradient(for: colorScheme)
                .ignoresSafeArea()
        )
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $selectedProfile) { profile in
            RoleExperienceSheet(
                profile: profile,
                notificationsMuted: $notificationsMuted,
                immersiveBackground: $immersiveBackground,
                quickRepliesEnabled: $quickRepliesEnabled,
                onClearChat: { showClearConfirmation = true },
                onShareChat: { shareChatLink() }
            )
        }
        .task {
            await viewModel.loadCharacterState()
        }
        .confirmationDialog("确定清空这段对话？", isPresented: $showClearConfirmation, titleVisibility: .visible) {
            Button("清空并保留角色", role: .destructive) {
                withAnimation { viewModel.messages.removeAll() }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("该操作不会删除服务器记录，仅清空设备暂存内容。")
        }
    }

    private var chatPage: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 14) {
                    if viewModel.isLoading && viewModel.messages.isEmpty {
                        ProgressView("载入历史对话中…")
                            .tint(.white)
                            .padding(.top, 40)
                    }
                    ForEach(viewModel.messages) { message in
                        MessageBubble(
                            message: message,
                            onCopy: { copyToClipboard(message.text) },
                            onRegenerate: message.isFromUser ? nil : {
                                Task {
                                    await viewModel.regenerateResponse(for: message)
                                }
                            },
                            activeActionMessageID: $activeActionMessageID
                        )
                        .id(message.id)
                    }
                    if viewModel.isGenerating {
                        TypingIndicatorView()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading)
                            .padding(.top, 6)
                    }
                    Color.clear.frame(height: 1).id(bottomAnchorID)
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
            .onChange(of: viewModel.messages.count) { _, _ in
                scrollToBottom(proxy: proxy)
            }
            .task {
                await viewModel.loadMessages()
                scrollToBottom(proxy: proxy)
            }
        }
        .onTapGesture {
            activeActionMessageID = nil
        }
        .overlay(alignment: .topTrailing) {
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(8)
                    .background(Color.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 12))
                    .padding()
            }
        }
    }

    private var panelProfile: ChatProfile? {
        matchingProfile()
    }

    private func presentRoleSheet() {
        if let profile = matchingProfile() {
            selectedProfile = profile
        } else {
            selectedProfile = fallbackProfile(from: viewModel.preview)
        }
    }

    private func matchingProfile() -> ChatProfile? {
        if let characterId = viewModel.preview.characterId,
           let profile = characterStore.profiles.first(where: { $0.characterId == characterId }) {
            return profile
        }
        return characterStore.profiles.first(where: { $0.name == viewModel.preview.name })
    }

    private func fallbackProfile(from preview: ChatPreview) -> ChatProfile {
        ChatProfile(
            characterId: preview.characterId,
            name: preview.name,
            tagline: "沉浸式角色对话",
            description: preview.snippet.isEmpty ? "与角色的实时对话" : preview.snippet,
            traits: [],
            rating: 4.8,
            likes: 0,
            chats: 0,
            views: 0,
            badge: .active,
            heroIcon: preview.avatar,
            colorStops: [Color(red: 0.91, green: 0.32, blue: 0.63), Color(red: 0.36, green: 0.21, blue: 0.55)],
            imageURL: preview.avatarURL
        )
    }

    private func shareChatLink() {
        let identifier = viewModel.preview.chatUUID?.uuidString
            ?? viewModel.preview.chatId.map(String.init)
            ?? viewModel.preview.id
        let link = "https://yychat.app/chats/\(identifier)"
        UIPasteboard.general.string = link
    }

    private var hintStrip: some View {
        HStack(spacing: 12) {
            Image(systemName: pagerIndex == 0 ? "arrow.left" : "arrow.right")
                .font(.caption)
            Text(pagerIndex == 0 ? "左滑显示角色状态" : "右滑返回角色聊天")
                .font(.caption)
        }
        .foregroundStyle(primaryTextColor(for: colorScheme))
        .padding(.vertical, 6)
    }

    private func sendCurrentMessage() {
        let text = draftText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draftText = ""
        Task {
            await viewModel.sendMessage(text)
        }
    }

    private func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        DispatchQueue.main.async {
            withAnimation {
                proxy.scrollTo(bottomAnchorID, anchor: .bottom)
            }
        }
    }
}

private struct ChatHeader: View {
    let preview: ChatPreview
    var onAvatarTap: () -> Void = {}
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        HStack {
            Button(action: { dismiss() }) {
                Image(systemName: "chevron.backward")
                    .font(.headline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(primaryTextColor(for: colorScheme))

            Spacer()
            HStack(spacing: 12) {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(preview.name)
                        .font(.headline)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                    Text(preview.snippet)
                        .font(.caption)
                        .lineLimit(1)
                        .foregroundStyle(secondaryTextColor(for: colorScheme))
                }
                Button(action: onAvatarTap) {
                    AvatarView(symbolName: preview.avatar, url: preview.avatarURL, size: 48, backgroundColor: cardBackgroundColor(for: colorScheme, intensity: 0.2))
                        .overlay(
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical)
    }
}

private struct CharacterStatePage: View {
    let metrics: [CharacterStateMetric]
    let isLoading: Bool
    let errorMessage: String?
    let updatedText: String?
    let onRefresh: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ScrollView(showsIndicators: true) {
            VStack(spacing: 20) {
                header
                content
            }
            .padding(.horizontal)
            .padding(.top, 8)
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("角色状态")
                    .font(.title3.bold())
                    .foregroundStyle(primaryTextColor(for: colorScheme))
                if let updatedText {
                    Text("更新于 \(updatedText)")
                        .font(.caption)
                        .foregroundStyle(tertiaryTextColor(for: colorScheme))
                }
            }
            Spacer()
            Button(action: onRefresh) {
                Label("刷新", systemImage: "arrow.clockwise")
                    .labelStyle(.iconOnly)
                    .font(.body.weight(.semibold))
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("同步角色状态中…")
                .padding(.top, 40)
        } else if let errorMessage {
            Text(errorMessage)
                .font(.callout)
                .foregroundStyle(.red)
        } else if metrics.isEmpty {
            Text("暂无可展示的状态")
                .font(.callout)
                .foregroundStyle(secondaryTextColor(for: colorScheme))
                .padding(.top, 20)
        } else {
            VStack(spacing: 16) {
                ForEach(metrics) { metric in
                    CharacterStateMetricCard(metric: metric)
                }
            }
        }
    }
}

private struct RoleExperienceSheet: View {
    let profile: ChatProfile
    @Binding var notificationsMuted: Bool
    @Binding var immersiveBackground: Bool
    @Binding var quickRepliesEnabled: Bool
    let onClearChat: () -> Void
    let onShareChat: () -> Void
    @State private var galleryIndex = 0
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    private enum GallerySource: Identifiable {
        case image(URL)
        case gradient([Color])
        case symbol(String)

        var id: String {
            switch self {
            case .image(let url): return "img-\(url.absoluteString)"
            case .gradient(let colors): return "grad-\(colors.count)"
            case .symbol(let name): return "symbol-\(name)"
            }
        }
    }

    private var gallerySources: [GallerySource] {
        var sources: [GallerySource] = []
        if let url = profile.imageURL {
            sources.append(.image(url))
        }
        sources.append(.gradient(profile.colorStops))
        sources.append(.symbol(profile.heroIcon))
        return sources
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    gallerySection
                    detailSection
                    settingsSection
                    actionSection
                }
                .padding(.horizontal, 24)
                .padding(.top, 20)
                .padding(.bottom, 32)
            }
            .background(appBackgroundGradient(for: colorScheme).ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark")
                    }
                }
            }
        }
    }

    private var gallerySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            TabView(selection: $galleryIndex) {
                ForEach(Array(gallerySources.enumerated()), id: \.offset) { index, source in
                    galleryContent(for: source)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))
            .frame(height: 320)
            Text(profile.tagline)
                .font(.headline)
                .foregroundStyle(primaryTextColor(for: colorScheme))
        }
    }

    @ViewBuilder
    private func galleryContent(for source: GallerySource) -> some View {
        switch source {
        case .image(let url):
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.5))
                case .failure:
                    LinearGradient(colors: profile.colorStops, startPoint: .top, endPoint: .bottom)
                case .empty:
                    ProgressView()
                @unknown default:
                    LinearGradient(colors: profile.colorStops, startPoint: .top, endPoint: .bottom)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
        case .gradient(let colors):
            LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
        case .symbol(let name):
            LinearGradient(colors: profile.colorStops, startPoint: .topLeading, endPoint: .bottomTrailing)
                .overlay(
                    Image(systemName: name)
                        .resizable()
                        .scaledToFit()
                        .padding(60)
                        .foregroundStyle(.white.opacity(0.9))
                )
                .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
        }
    }

    private var detailSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(profile.name)
                .font(.largeTitle.bold())
                .foregroundStyle(primaryTextColor(for: colorScheme))
            Text(profile.description)
                .font(.body)
                .foregroundStyle(secondaryTextColor(for: colorScheme))
            if !profile.traits.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(profile.traits, id: \.self) { trait in
                            Text(trait)
                                .font(.caption)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.white.opacity(0.12), in: Capsule())
                        }
                    }
                }
            }
        }
        .padding(20)
        .background(cardBackgroundColor(for: colorScheme, intensity: colorScheme == .dark ? 0.28 : 0.12), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
    }

    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("聊天设置")
                .font(.headline)
                .foregroundStyle(primaryTextColor(for: colorScheme))
            Toggle("静音通知", isOn: $notificationsMuted)
            Toggle("沉浸式背景", isOn: $immersiveBackground)
            Toggle("展示快捷回复", isOn: $quickRepliesEnabled)
        }
        .toggleStyle(SwitchToggleStyle(tint: Color(red: 0.96, green: 0.45, blue: 0.71)))
        .padding(20)
        .background(cardBackgroundColor(for: colorScheme, intensity: colorScheme == .dark ? 0.25 : 0.1), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
    }

    private var actionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("快捷操作")
                .font(.headline)
                .foregroundStyle(primaryTextColor(for: colorScheme))
            HStack(spacing: 12) {
                QuickActionButton(title: "分享链接", icon: "link") { onShareChat() }
                QuickActionButton(title: "清空对话", icon: "trash") { onClearChat() }
            }
        }
        .padding(20)
        .background(cardBackgroundColor(for: colorScheme, intensity: colorScheme == .dark ? 0.22 : 0.09), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
    }
}

private struct MessageBubble: View {
    let message: ChatMessage
    let onCopy: () -> Void
    let onRegenerate: (() -> Void)?
    @Binding var activeActionMessageID: String?
    private let aiGradient = LinearGradient(colors: [Color(red: 0.93, green: 0.28, blue: 0.6), Color(red: 0.61, green: 0.35, blue: 0.95)], startPoint: .topLeading, endPoint: .bottomTrailing)
    private let userGradient = LinearGradient(colors: [Color(red: 0.4, green: 0.45, blue: 0.55), Color(red: 0.19, green: 0.23, blue: 0.31)], startPoint: .topLeading, endPoint: .bottomTrailing)
    @Environment(\.colorScheme) private var colorScheme
    @GestureState private var isPressing = false
    @State private var showMenu = false

    init(message: ChatMessage, onCopy: @escaping () -> Void, onRegenerate: (() -> Void)? = nil, activeActionMessageID: Binding<String?>) {
        self.message = message
        self.onCopy = onCopy
        self.onRegenerate = onRegenerate
        _activeActionMessageID = activeActionMessageID
    }

    var body: some View {
        HStack(alignment: .bottom) {
            if message.isFromUser { Spacer(minLength: 60) }

            bubbleContent
                .scaleEffect(isPressing ? 0.97 : 1)
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isPressing)
        .overlay(alignment: message.isFromUser ? .topTrailing : .topLeading) {
            if showMenu && activeActionMessageID == message.id {
                BubbleActionMenu(isUser: message.isFromUser, onCopy: {
                    hideMenu()
                    onCopy()
                }, onRegenerate: onRegenerate.map { regen in
                    {
                        hideMenu()
                        regen()
                    }
                })
                .offset(x: 12, y: 20)
            }
        }
                .simultaneousGesture(longPressGesture)

            if !message.isFromUser { Spacer(minLength: 60) }
        }
        .transition(.move(edge: message.isFromUser ? .trailing : .leading).combined(with: .opacity))
        .contentShape(Rectangle())
    }

    private var longPressGesture: some Gesture {
        LongPressGesture(minimumDuration: 0.35)
            .updating($isPressing) { value, state, _ in
                state = value
            }
            .onEnded { _ in
                activeActionMessageID = message.id
                showMenu = true
            }
    }

    @ViewBuilder
    private var bubbleContent: some View {
        VStack(alignment: message.isFromUser ? .trailing : .leading, spacing: 6) {
            Text(message.text)
                .font(.body)
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(message.isFromUser ? userGradient : aiGradient)
                        .shadow(color: (message.isFromUser ? Color.black : Color.pink).opacity(0.35), radius: 16, x: 0, y: 10)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(Color.white.opacity(0.15), lineWidth: 1)
                )
                .overlay(alignment: message.isFromUser ? .bottomTrailing : .bottomLeading) {
                    Capsule()
                        .fill(Color.white.opacity(0.12))
                        .frame(width: 32, height: 8)
                        .offset(x: message.isFromUser ? -10 : 10, y: 14)
                        .opacity(0.4)
                }

            Text(message.timestamp)
                .font(.caption2)
                .foregroundStyle(tertiaryTextColor(for: colorScheme))
        }
    }

    private var bubblePreview: some View {
        bubbleContent
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: message.isFromUser ? .trailing : .leading)
            .background(Color.clear)
    }

    private func hideMenu() {
        showMenu = false
        activeActionMessageID = nil
    }
}

private struct QuickActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text(title)
                    .font(.caption)
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 14)
            .background(cardBackgroundColor(for: colorScheme, intensity: 0.12), in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct CharacterStateMetricCard: View {
    let metric: CharacterStateMetric
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(metric.accentColor.opacity(0.8))
                        .frame(width: 10, height: 10)
                    Text(metric.title)
                        .font(.headline)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                }
                Spacer()
                if let scoreText = metric.scoreText {
                    Text(scoreText)
                        .font(.headline)
                        .foregroundStyle(primaryTextColor(for: colorScheme))
                }
            }

            if let progress = metric.progress {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(cardBackgroundColor(for: colorScheme, intensity: 0.12))
                        Capsule()
                            .fill(LinearGradient(colors: metric.accentColors, startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(16, geometry.size.width * progress))
                    }
                }
                .frame(height: 10)
            }

            Text(metric.detail)
                .font(.subheadline)
                .foregroundStyle(secondaryTextColor(for: colorScheme))
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(cardBackgroundColor(for: colorScheme, intensity: colorScheme == .dark ? 0.2 : 0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .stroke(cardBorderColor(for: colorScheme), lineWidth: 1)
                )
        )
    }
}

private struct BubbleActionMenu: View {
    let isUser: Bool
    let onCopy: () -> Void
    let onRegenerate: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(action: onCopy) {
                Label("复制", systemImage: "doc.on.doc")
                    .labelStyle(.titleAndIcon)
            }
            if let onRegenerate {
                Divider().frame(maxWidth: 90)
                Button(action: onRegenerate) {
                    Label("重新生成", systemImage: "arrow.triangle.2.circlepath")
                        .labelStyle(.titleAndIcon)
                }
            }
        }
        .font(.callout)
        .foregroundStyle(.primary)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
    }
}

private struct ChatInputBar: View {
    @Binding var text: String
    let isBusy: Bool
    let onSend: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 12) {
            Button(action: {}) {
                Image(systemName: "plus")
                    .font(.title3)
            }
            .frame(width: 44, height: 44)
            .background(cardBackgroundColor(for: colorScheme, intensity: 0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .disabled(isBusy)

            TextField("输入消息...", text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(cardBackgroundColor(for: colorScheme, intensity: 0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .foregroundStyle(primaryTextColor(for: colorScheme))
                .disabled(isBusy)

            Button(action: onSend) {
                Image(systemName: isBusy ? "hourglass" : "arrow.up.circle.fill")
                    .font(.title2)
            }
            .disabled(isBusy || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Button(action: {}) {
                Image(systemName: "waveform")
                    .font(.title3)
            }
            .disabled(true)
            .opacity(0.3)
        }
        .foregroundStyle(primaryTextColor(for: colorScheme))
    }
}

private struct TypingIndicatorView: View {
    @State private var animate = false

    var body: some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(
                LinearGradient(colors: [Color(red: 0.84, green: 0.32, blue: 0.84), Color(red: 0.52, green: 0.23, blue: 0.93)], startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            .overlay(
                HStack(spacing: 10) {
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(Color.white.opacity(0.9))
                            .frame(width: 12, height: 12)
                            .scaleEffect(animate ? 1 : 0.4)
                            .animation(
                                .easeInOut(duration: 0.6)
                                .repeatForever()
                                .delay(Double(index) * 0.15),
                                value: animate
                            )
                    }
                }
            )
            .frame(width: 110, height: 54)
            .shadow(color: Color(red: 0.9, green: 0.2, blue: 0.8).opacity(0.6), radius: 10, x: 0, y: 8)
            .onAppear { animate = true }
    }
}

private struct PlaceholderView: View {
    let title: String
    let systemImage: String

    var body: some View {
        Color(.systemGroupedBackground)
            .ignoresSafeArea()
            .overlay(
                VStack(spacing: 12) {
                    Image(systemName: systemImage)
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Coming soon")
                        .font(.headline)
                    Text(title)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            )
            .tabItem {
                Image(systemName: systemImage)
                Text(title)
            }
    }
}

#Preview {
    ContentView()
}
