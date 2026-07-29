# Template Homebrew formula for the mna CLI.
#
# This file is versioned alongside the source as a template. To make
# `brew install akoso/tap/mna` work, copy this file into the separate
# `akoso/homebrew-tap` GitHub repo at `Formula/mna.rb`, and update
# `version` + each `sha256` after a new GitHub Release is published.
# See RELEASING.md.

class Mna < Formula
  desc "Command-line tool for My Next Adventure trip planning"
  homepage "https://github.com/akoso/mna-cli"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/akoso/mna-cli/releases/download/v#{version}/mna-darwin-arm64.tar.gz"
      sha256 "REPLACE_WITH_DARWIN_ARM64_SHA256"
    end
    on_intel do
      url "https://github.com/akoso/mna-cli/releases/download/v#{version}/mna-darwin-x64.tar.gz"
      sha256 "REPLACE_WITH_DARWIN_X64_SHA256"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/akoso/mna-cli/releases/download/v#{version}/mna-linux-x64.tar.gz"
      sha256 "REPLACE_WITH_LINUX_X64_SHA256"
    end
  end

  def install
    binary_name = if OS.mac? && Hardware::CPU.arm?
                    "mna-darwin-arm64"
                  elsif OS.mac?
                    "mna-darwin-x64"
                  elsif OS.linux?
                    "mna-linux-x64"
                  end
    bin.install binary_name => "mna"
  end

  test do
    system "#{bin}/mna", "--version"
  end
end
