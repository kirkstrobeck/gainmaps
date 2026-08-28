class Gainmap < Formula
  desc "Convert images to Ultra HDR JPEG gain maps"
  homepage "https://gainmaps.com"
  url "https://github.com/kirkstrobeck/gainmaps/releases/download/v1.1.0/gainmap-1.1.0.tgz"
  version "1.1.0"
  sha256 "7eeef73322946c01fd0cd472e647758ec21bf57c3e888326d47df8670d43f354"
  license "MIT"
  head "https://github.com/kirkstrobeck/gainmaps.git", branch: "main"

  depends_on "node"

  def install
    return install_head if build.head?
    system "npm", "install", *std_npm_args
    write_cli_wrapper "#{libexec}/lib/node_modules/gainmap/dist/cli.js"
  end

  def install_head
    cd "packages/gainmap" do
      system "npm", "install"
      system "npm", "run", "build"
      system "npm", "prune", "--omit=dev"
      libexec.install "dist", "node_modules", "package.json"
      (pkgshare/"test/fixtures").install "test/fixtures/input"
      write_cli_wrapper "#{libexec}/dist/cli.js"
    end
  end

  def write_cli_wrapper(cli_js)
    (bin/"gainmap").write <<~EOS
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{cli_js}" "$@"
    EOS
    chmod 0755, bin/"gainmap"
  end

  test do
    assert_match "gainmap", shell_output("#{bin}/gainmap --help")
    assert_match "gainmap #{version}", shell_output("#{bin}/gainmap --version 2>&1")

    fixture = [
      "#{libexec}/lib/node_modules/gainmap/test/fixtures/input/photo.jpg",
      "#{pkgshare}/test/fixtures/input/photo.jpg",
    ].find { |candidate| File.exist?(candidate) }

    assert fixture, "test fixture not found"

    output = testpath/"out.jpg"
    system bin/"gainmap", fixture, "-o", output.to_s, "--offline", "--quiet"
    assert_path_exists output

    magic = output.binread(2)
    assert_equal "\xFF\xD8".b, magic, "output must be JPEG (FF D8)"

    content = output.binread
    assert(
      content.include?("GainMap") || content.include?("hdrgm") || content.include?("MPF"),
      "output must embed gain-map metadata"
    )
  end
end
