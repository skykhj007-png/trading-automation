# ============================================
# Auto Git Sync - 1시간마다 GitHub 자동 저장
# ============================================
#
# 사용법:
# 1. 이 스크립트가 있는 폴더에서 실행
# 2. 또는 setup-auto-sync.bat 실행하면 자동 등록
#
# ============================================

$repoPath = $PSScriptRoot
Set-Location $repoPath

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logFile = Join-Path $repoPath "auto-sync.log"

function Write-Log {
    param($message)
    $logEntry = "[$timestamp] $message"
    Add-Content -Path $logFile -Value $logEntry
    Write-Host $logEntry
}

Write-Log "=== Auto Sync 시작 ==="

# Git 상태 확인
$status = git status --porcelain

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Log "변경사항 없음 - 스킵"

    # 원격과 동기화 확인
    git fetch origin main 2>$null
    $behind = git rev-list --count HEAD..origin/main 2>$null

    if ($behind -gt 0) {
        Write-Log "원격에 새 커밋 있음 - Pull 실행"
        git pull origin main
    }
} else {
    Write-Log "변경사항 감지됨:"
    Write-Log $status

    # 원격과 비교해서 충돌 가능성 확인
    git fetch origin main 2>$null
    $behind = git rev-list --count HEAD..origin/main 2>$null

    if ($behind -gt 0) {
        # 원격에 새 커밋이 있으면 백업 후 처리
        $backupBranch = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Log "충돌 가능! 백업 브랜치 생성: $backupBranch"

        git stash
        git pull origin main
        git stash pop

        # 충돌 발생시 백업
        $mergeConflict = git status --porcelain | Select-String "^UU"
        if ($mergeConflict) {
            Write-Log "충돌 발생! 백업 브랜치에 저장"
            git checkout -b $backupBranch
            git add -A
            git commit -m "Backup: 충돌 발생 시점 백업 ($timestamp)"
            git push origin $backupBranch
            git checkout main
            Write-Log "백업 완료: $backupBranch"
        }
    }

    # 변경사항 커밋 및 푸시
    git add -A
    $commitMsg = "Auto-sync: $timestamp"
    git commit -m $commitMsg

    $pushResult = git push origin main 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Log "GitHub 저장 완료!"
    } else {
        Write-Log "Push 실패: $pushResult"

        # 실패시 백업 브랜치로 저장
        $backupBranch = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        git checkout -b $backupBranch
        git push origin $backupBranch
        Write-Log "백업 브랜치에 저장: $backupBranch"
        git checkout main
    }
}

Write-Log "=== Auto Sync 완료 ==="
