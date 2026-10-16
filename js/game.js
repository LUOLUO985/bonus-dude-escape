let game

const gameOptions = {
    dudeGravity: 800,
    dudeSpeed: 300,
    dudeJump: 600,
    dropTime: 250,

    maxHP: 3,
    meteorDamage: 1,
    hitInvulnerableTime: 1200,
    hitKnockBack: 260,

    boostPower: 800,
    boostTime: 1200,
    rocketPoints: 1,
    smashPoints: 1,

    starPoints: 1,
    bigStarPoints: 3,
    bigStarChance: 0.2,

    startFallSpeed: 220,
    fallSpeedPerLevel: 60,
    maxFallSpeed: 760,

    groundBaseSpeed: 55,
    groundSpeedPerLevel: 7,
    maxGroundSpeed: 200,
    platformColumns: 3,
    groundGapMin: 90,
    groundGapMax: 125,
    columnShift: 55,

    levelTime: 10000,
    levelBonus: 2,
    startItemDelay: 700,
    itemDelayPerLevel: 35,
    minItemDelay: 420,
    starChance: 0.5,
    meteorBaseChance: 0.35,
    meteorChancePerLevel: 0.05,
    maxMeteorChance: 0.6
}

window.onload = function() {
    let gameConfig = {
        type: Phaser.AUTO,
        backgroundColor: "#112211",
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 800,
            height: 1000,
        },
        pixelArt: true,
        physics: {
            default: "arcade",
            arcade: {
                gravity: {
                    y: 0
                }
            }
        },
        scene: PlayGame
    }

    game = new Phaser.Game(gameConfig)
    window.focus();
}

class PlayGame extends Phaser.Scene {

    constructor() {
        super("PlayGame")
        this.score = 0;
        this.hp = gameOptions.maxHP;
    }

    preload() {
        this.load.image("ground", "assets/platform.png")
        this.load.image("star", "assets/star.png")
        this.load.image("bigstar", "assets/bigstar.png")
        this.load.image("meteor", "assets/meteor.png")
        this.load.image("rocket", "assets/rocket.png")
        this.load.image("heart", "assets/heart.png")
        this.load.image("warning", "assets/warning.png")
        this.load.spritesheet("dude", "assets/dude.png", {frameWidth: 32, frameHeight: 48})
    }

    create() {
        this.physics.resume()

        this.score = 0
        this.hp = gameOptions.maxHP
        this.level = 1
        this.playTime = 0
        this.isBoosting = false
        this.isGameOver = false
        this.invulnerableUntil = 0
        this.boostEndTime = 0
        this.dropUntil = 0

        this.groundGroup = this.physics.add.group({
            immovable: true,
            allowGravity: false
        })

        this.columnXs = []
        this.laneGaps = []
        this.laneClocks = []
        for(let i = 0; i < gameOptions.platformColumns; i++) {
            this.columnXs.push(this.columnBaseX(i))
            this.laneGaps.push(this.randomGap())
            this.laneClocks.push(Phaser.Math.Between(0, 600))

            let y = -40
            while(y < game.config.height + 200) {
                this.addGroundAt(this.nextColumnX(i), y)
                y += this.randomGap()
            }
        }

        let startX = game.config.width / 2
        let startY = game.config.height / 2
        let startDistance = Number.MAX_VALUE
        this.groundGroup.getChildren().forEach((ground) => {
            const distance = Math.abs(ground.x - game.config.width / 2)
                + Math.abs(ground.y - game.config.height / 2)
            if(distance < startDistance) {
                startDistance = distance
                startX = ground.x
                startY = ground.y
            }
        })

        this.dude = this.physics.add.sprite(startX, startY - 80, "dude")
        this.dude.body.gravity.y = gameOptions.dudeGravity
        this.dudeGroundCollider = this.physics.add.collider(this.dude, this.groundGroup, null, this.canPassThrough, this)

        this.starsGroup = this.physics.add.group({})
        this.physics.add.collider(this.starsGroup, this.groundGroup)
        this.physics.add.overlap(this.dude, this.starsGroup, this.collectStar, null, this)

        this.meteorsGroup = this.physics.add.group({allowGravity: false})
        this.physics.add.overlap(this.dude, this.meteorsGroup, this.hitMeteor, null, this)

        this.rocketsGroup = this.physics.add.group({allowGravity: false})
        this.physics.add.overlap(this.dude, this.rocketsGroup, this.collectRocket, null, this)

        this.createInterface()

        this.cursors = this.input.keyboard.createCursorKeys()
        this.wasd = this.input.keyboard.addKeys("W,A,S,D")

        this.anims.create({
            key: "left",
            frames: this.anims.generateFrameNumbers("dude", {start: 0, end: 3}),
            frameRate: 10,
            repeat: -1
        })

        this.anims.create({
            key: "turn",
            frames: [{key: "dude", frame: 4}],
            frameRate: 10,
        })

        this.anims.create({
            key: "right",
            frames: this.anims.generateFrameNumbers("dude", {start: 5, end: 8}),
            frameRate: 10,
            repeat: -1
        })

        this.itemTimer = this.time.addEvent({
            callback: this.addItem,
            callbackScope: this,
            delay: gameOptions.startItemDelay,
            loop: true
        })
    }

    createInterface() {
        this.heartIcons = []
        for(let i = 0; i < gameOptions.maxHP; i++) {
            const heart = this.add.image(30 + i * 28, 30, "heart")
            heart.setDepth(10)
            this.heartIcons.push(heart)
        }

        this.add.image(game.config.width - 116, 26, "star").setDepth(10)
        this.scoreText = this.add.text(game.config.width - 96, 8, "0", {fontSize: "30px", fill: "#ffffff"})
        this.scoreText.setDepth(10)

        this.levelText = this.add.text(30, 58, "", {fontSize: "18px", fill: "#9ee493"})
        this.levelText.setDepth(10)
        this.levelText.setText(this.getLevelText())

        const hint = this.add.text(
            game.config.width / 2,
            game.config.height - 70,
            "LEFT / RIGHT  or  A D    move        UP  or  W    jump\nDOWN  or  S    drop through the platform you stand on\nyellow star +1        green star +3        rocket = blast upward\nmeteor -1 heart    dodge the red markers at the top",
            {fontSize: "18px", fill: "#cfe8cf", align: "center"}
        )
        hint.setOrigin(0.5)
        hint.setDepth(10)
        this.tweens.add({targets: hint, alpha: 0, delay: 6000, duration: 1000})

        this.updateHearts()
    }

    columnBaseX(index) {
        return game.config.width * (index + 0.5) / gameOptions.platformColumns
    }

    nextColumnX(index) {
        const base = this.columnBaseX(index)
        const shift = Phaser.Math.Between(-gameOptions.columnShift, gameOptions.columnShift)
        this.columnXs[index] = Phaser.Math.Clamp(this.columnXs[index] + shift,
            base - gameOptions.columnShift, base + gameOptions.columnShift)
        return this.columnXs[index]
    }

    randomGap() {
        return Phaser.Math.Between(gameOptions.groundGapMin, gameOptions.groundGapMax)
    }

    addGroundAt(x, y) {
        const ground = this.groundGroup.create(x, y, "ground")
        ground.setVelocityY(this.getGroundSpeed())
        return ground
    }

    updateGrounds(delta) {
        for(let i = 0; i < gameOptions.platformColumns; i++) {
            this.laneClocks[i] += delta

            if(this.laneClocks[i] >= this.laneGaps[i] / this.getGroundSpeed() * 1000) {
                this.laneClocks[i] = 0
                this.addGroundAt(this.nextColumnX(i), -40)
                this.laneGaps[i] = this.randomGap()
            }
        }
    }

    addItem() {
        if(this.isGameOver) {
            return
        }

        const fallSpeed = this.getFallSpeed()
        const dice = Math.random()
        const meteorChance = Math.min(gameOptions.maxMeteorChance,
            gameOptions.meteorBaseChance + (this.level - 1) * gameOptions.meteorChancePerLevel)

        if(dice < gameOptions.starChance) {
            this.addStar(fallSpeed)
        }
        else if(dice < gameOptions.starChance + meteorChance) {
            this.addMeteor(fallSpeed)
        }
        else {
            this.addRocket(fallSpeed)
        }
    }

    addStar(fallSpeed) {
        const isBig = Math.random() < gameOptions.bigStarChance
        const star = this.starsGroup.create(Phaser.Math.Between(20, game.config.width - 20), -20,
            isBig ? "bigstar" : "star")
        star.setVelocityY(fallSpeed)
        star.setData("points", isBig ? gameOptions.bigStarPoints : gameOptions.starPoints)
    }

    addMeteor(fallSpeed) {
        const x = Phaser.Math.Between(20, game.config.width - 20)
        const warning = this.add.image(x, 22, "warning")
        warning.setDepth(15)
        this.tweens.add({targets: warning, alpha: 0.15, duration: 130, yoyo: true, repeat: 3})

        this.time.delayedCall(600, () => {
            warning.destroy()

            if(this.isGameOver) {
                return
            }

            const meteor = this.meteorsGroup.create(x, -60, "meteor")
            meteor.setVelocityY(fallSpeed * 1.15)
            meteor.setAngularVelocity(Phaser.Math.Between(-180, 180))
        })
    }

    addRocket(fallSpeed) {
        const rocket = this.rocketsGroup.create(Phaser.Math.Between(20, game.config.width - 20), -60, "rocket")
        rocket.setVelocityY(fallSpeed * 1.3)
    }

    collectStar(dude, star) {
        if(this.isGameOver || star.active === false) {
            return
        }

        const points = star.getData("points")
        star.disableBody(true, true)
        this.score += points
        this.scoreText.setText(this.score)
        this.showPopup(star.x, star.y, "+" + points, points > 1 ? "#66e0ff" : "#ffe066")
    }

    hitMeteor(dude, meteor) {
        if(this.isGameOver || meteor.active === false) {
            return
        }

        if(this.isBoosting) {
            meteor.destroy()
            this.score += gameOptions.smashPoints
            this.scoreText.setText(this.score)
            this.showPopup(meteor.x, meteor.y, "+" + gameOptions.smashPoints, "#ffaa00")
            this.cameras.main.shake(80, 0.004)
            return
        }

        if(this.time.now < this.invulnerableUntil) {
            return
        }

        meteor.destroy()
        this.hp -= gameOptions.meteorDamage
        this.updateHearts()
        this.invulnerableUntil = this.time.now + gameOptions.hitInvulnerableTime
        this.dude.body.velocity.y = -gameOptions.hitKnockBack
        this.cameras.main.shake(160, 0.008)
        this.showPopup(this.dude.x, this.dude.y - 30, "-" + gameOptions.meteorDamage + " HP", "#ff5555")

        if(this.hp <= 0) {
            this.gameOver()
        }
    }

    collectRocket(dude, rocket) {
        if(this.isGameOver || rocket.active === false) {
            return
        }

        rocket.destroy()
        this.score += gameOptions.rocketPoints
        this.scoreText.setText(this.score)
        this.showPopup(this.dude.x, this.dude.y - 30, "BOOST!", "#88ddff")

        this.dudeGroundCollider.active = false
        this.isBoosting = true
        this.boostEndTime = this.time.now + gameOptions.boostTime
        this.dude.body.velocity.y = -gameOptions.boostPower
        this.dude.body.velocity.x = 0
    }

    endBoost() {
        this.isBoosting = false
        this.dudeGroundCollider.active = true
    }

    canPassThrough(dude, ground) {
        if(this.time.now < this.dropUntil) {
            return false
        }

        const previousBottom = dude.body.bottom - dude.body.deltaY()
        return dude.body.velocity.y > 0 && previousBottom <= ground.body.top
    }

    getFallSpeed() {
        return Math.min(
            gameOptions.startFallSpeed + (this.level - 1) * gameOptions.fallSpeedPerLevel,
            gameOptions.maxFallSpeed
        )
    }

    getGroundSpeed() {
        return Math.min(
            gameOptions.groundBaseSpeed + (this.level - 1) * gameOptions.groundSpeedPerLevel,
            gameOptions.maxGroundSpeed
        )
    }

    getLevelText() {
        return "LEVEL " + this.level + "        FALL SPEED " + Math.round(this.getFallSpeed())
            + "        PLATFORM SPEED " + Math.round(this.getGroundSpeed())
    }

    updateLevel() {
        const level = 1 + Math.floor(this.playTime / gameOptions.levelTime)
        if(level === this.level) {
            return
        }

        this.level = level
        this.score += gameOptions.levelBonus
        this.scoreText.setText(this.score)

        this.groundGroup.setVelocityY(this.getGroundSpeed())

        this.itemTimer.remove()
        this.itemTimer = this.time.addEvent({
            callback: this.addItem,
            callbackScope: this,
            delay: Math.max(gameOptions.minItemDelay,
                gameOptions.startItemDelay - (this.level - 1) * gameOptions.itemDelayPerLevel),
            loop: true
        })

        this.levelText.setText(this.getLevelText())
        this.showToast("LEVEL " + this.level + " !  EVERYTHING FALLS FASTER")
    }

    updateHearts() {
        this.heartIcons.forEach((heart, index) => {
            heart.setAlpha(index < this.hp ? 1 : 0.15)
        })
    }

    showPopup(x, y, message, color) {
        const popup = this.add.text(x, y, message, {fontSize: "22px", fill: color})
        popup.setOrigin(0.5)
        popup.setDepth(20)
        this.tweens.add({
            targets: popup,
            y: y - 40,
            alpha: 0,
            duration: 600,
            onComplete: () => popup.destroy()
        })
    }

    showToast(message) {
        const toast = this.add.text(game.config.width / 2, game.config.height * 0.32, message,
            {fontSize: "26px", fill: "#ffe066"})
        toast.setOrigin(0.5)
        toast.setDepth(20)
        this.tweens.add({
            targets: toast,
            y: toast.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => toast.destroy()
        })
    }

    cleanUp() {
        const bottom = game.config.height + 120
        const groups = [this.groundGroup, this.starsGroup, this.meteorsGroup, this.rocketsGroup]

        groups.forEach((group) => {
            group.getChildren().slice().forEach((child) => {
                if(child.y > bottom) {
                    child.destroy()
                }
            })
        })
    }

    gameOver() {
        if(this.isGameOver) {
            return
        }

        this.isGameOver = true
        this.physics.pause()
        this.dude.anims.stop()
        this.dude.setTint(0xff3333)

        const overText = this.add.text(game.config.width / 2, game.config.height / 2 - 40,
            "GAME OVER\nSCORE " + this.score, {fontSize: "44px", fill: "#ffffff", align: "center"})
        overText.setOrigin(0.5)
        overText.setDepth(20)

        this.time.delayedCall(1500, () => this.scene.restart())
    }

    update(time, delta) {
        if(this.isGameOver) {
            return
        }

        this.playTime += delta
        this.updateLevel()

        this.updateGrounds(delta)

        if(this.cursors.left.isDown || this.wasd.A.isDown) {
            this.dude.body.velocity.x = -gameOptions.dudeSpeed
            this.dude.anims.play("left", true)
        }
        else if(this.cursors.right.isDown || this.wasd.D.isDown) {
            this.dude.body.velocity.x = gameOptions.dudeSpeed
            this.dude.anims.play("right", true)
        }
        else {
            this.dude.body.velocity.x = 0
            this.dude.anims.play("turn", true)
        }

        const onGround = this.dude.body.blocked.down || this.dude.body.touching.down
        if((this.cursors.up.isDown || this.wasd.W.isDown) && onGround) {
            this.dude.body.velocity.y = -gameOptions.dudeJump
        }

        if((this.cursors.down.isDown || this.wasd.S.isDown) && onGround) {
            this.dropUntil = this.time.now + gameOptions.dropTime
        }

        this.dude.x = Phaser.Math.Clamp(this.dude.x, 20, game.config.width - 20)

        if(this.dude.y < 10) {
            this.dude.y = 10
            if(this.dude.body.velocity.y < 0) {
                this.dude.body.velocity.y = 0
            }
        }

        if(this.isBoosting && (this.dude.body.velocity.y >= 0 || this.time.now > this.boostEndTime)) {
            this.endBoost()
        }

        if(this.isBoosting) {
            this.dude.setTint(0x88ddff)
        }
        else {
            this.dude.clearTint()
        }
        this.dude.setAlpha(this.time.now < this.invulnerableUntil ? 0.55 : 1)

        if(this.dude.y > game.config.height + 40) {
            this.gameOver()
        }

        this.cleanUp()
    }
}
